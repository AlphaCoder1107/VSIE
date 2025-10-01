// @ts-nocheck
// Supabase Edge Function: ops-list-events
// Manager-only: lists seminar_events using EVENT_MANAGER_EMAILS allowlist.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const env = (globalThis as any).Deno?.env
const SUPABASE_URL = env.get('SUPABASE_URL') as string
const SERVICE_ROLE_KEY = env.get('SUPABASE_SERVICE_ROLE_KEY') as string

function parseAllowlist(v?: string) {
  return String(v || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => !!s)
}

const MANAGER_EMAILS: string[] = parseAllowlist(env.get('EVENT_MANAGER_EMAILS'))

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  return new Response(JSON.stringify(body), { ...init, headers })
}

async function getActiveOnly(req: Request): Promise<boolean> {
  // Manager UI usually wants all events. Default: false
  let activeOnly = false
  try {
    if (req.method === 'POST') {
      const body = await req.json()
      if (typeof body?.activeOnly === 'boolean') activeOnly = body.activeOnly
    } else {
      const u = new URL(req.url)
      const qs = u.searchParams.get('activeOnly')
      if (qs != null) activeOnly = /^(true|1|yes)$/i.test(qs)
    }
  } catch { /* ignore parse errors */ }
  return activeOnly
}

async function getAuthedEmail(token: string): Promise<{ email?: string; status?: number; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error) return { status: 401, error: 'auth-getUser-failed' }
    const email = data?.user?.email?.toLowerCase()
    if (!email) return { status: 401, error: 'auth-missing-email' }
    return { email }
  } catch {
    return { status: 401, error: 'auth-exception' }
  }
}

serve(async (req: Request) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env')
    return json({ error: 'server-misconfigured' }, { status: 500 })
  }

  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'method-not-allowed' }, { status: 405 })

  const auth = req.headers.get('Authorization') || req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return json({ error: 'missing-bearer-token' }, { status: 401 })

  const { email, status, error } = await getAuthedEmail(token)
  if (!email) return json({ error: error || 'unauthorized' }, { status: status || 401 })

  // Enforce allowlist strictly; empty list denies all for safety
  const allowed = MANAGER_EMAILS.includes(email)
  if (!allowed) {
    console.warn('ops-list-events forbidden for', email)
    return json({ error: 'forbidden' }, { status: 403 })
  }

  const activeOnly = await getActiveOnly(req)
  async function runSelect(full: boolean) {
    let sel = 'slug, name, price_paise, active, created_at'
    if (full) sel += ', image_url, title, excerpt, date, location'
    let q = supabaseAdmin
      .from('seminar_events')
      .select(sel)
      .order('created_at', { ascending: false })
    if (activeOnly) q = q.eq('active', true)
    return q
  }

  let { data, error: dbErr } = await runSelect(true)
  if (dbErr && /does not exist/i.test(dbErr.message || '')) {
    // Fallback if new columns aren't present yet
    const res2 = await runSelect(false)
    const { data: d2, error: e2 } = await res2
    if (e2) return json({ error: e2.message }, { status: 500 })
    data = d2
  } else if (dbErr) {
    return json({ error: dbErr.message }, { status: 500 })
  }

  console.log('ops-list-events ok for', email, 'count=', data?.length || 0, 'activeOnly=', activeOnly)
  return json({ ok: true, events: data || [] })
})
