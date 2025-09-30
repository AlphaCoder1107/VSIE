// @ts-nocheck
// Supabase Edge Function: admin-list-seminar-events
// Returns aggregated seminar registration stats grouped by event_slug.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL') as string
const SERVICE_ROLE_KEY = (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const ADMIN_EMAILS: string[] = String(((globalThis as any).Deno?.env.get('ADMIN_EMAILS')) || '')
  .split(',')
  .map((s: string) => s.trim().toLowerCase())
  .filter((s: string) => !!s)

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  return new Response(JSON.stringify(body), { ...init, headers })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })

  const auth = req.headers.get('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userData?.user?.email) return json({ error: 'Unauthorized' }, { status: 401 })
  const email = userData.user.email.toLowerCase()
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(email)) return json({ error: 'Forbidden' }, { status: 403 })

  // We will compute aggregates in JS using a simple group-by
  const { data, error } = await supabaseAdmin
    .from('seminar_registrations')
    .select('event_slug, created_at, amount_paise')
  if (error) return json({ error: error.message }, { status: 500 })

  const groups: Record<string, { event_slug: string; count: number; amount_sum: number; last_created_at: string | null }> = {}
  for (const r of data || []) {
    const slug = String(r.event_slug || 'unknown')
    if (!groups[slug]) groups[slug] = { event_slug: slug, count: 0, amount_sum: 0, last_created_at: null }
    groups[slug].count += 1
    groups[slug].amount_sum += Number(r.amount_paise || 0)
    const ts = r.created_at ? new Date(r.created_at).toISOString() : null
    if (ts && (!groups[slug].last_created_at || ts > groups[slug].last_created_at)) groups[slug].last_created_at = ts
  }

  const rows = Object.values(groups).sort((a, b) => (b.last_created_at || '').localeCompare(a.last_created_at || ''))
  return json({ rows })
})
