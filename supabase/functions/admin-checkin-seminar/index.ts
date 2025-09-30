// @ts-nocheck
// Supabase Edge Function: admin-checkin-seminar
// Admin-only: verifies a registration by code or id and marks it checked_in

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL') as string
const SERVICE_ROLE_KEY = (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const ADMIN_EMAILS: string[] = String(((globalThis as any).Deno?.env.get('ADMIN_EMAILS')) || '')
  .split(',').map((s: string) => s.trim().toLowerCase()).filter((s: string) => !!s)

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

  const { code, id, event_slug } = await req.json().catch(() => ({})) as { code?: string; id?: number; event_slug?: string }
  if (!code && !id) return json({ error: 'missing-code-or-id' }, { status: 400 })

  let builder = supabaseAdmin.from('seminar_registrations').select('*').limit(1)
  if (id) builder = builder.eq('id', id)
  else builder = builder.eq('registration_code', String(code))
  if (event_slug) builder = builder.eq('event_slug', event_slug)

  const { data, error } = await builder.single()
  if (error) return json({ error: error.message }, { status: 500 })
  if (!data) return json({ error: 'not-found' }, { status: 404 })

  // Already checked in? Return idempotently
  if ((data as any).checked_in) return json({ ok: true, already: true, row: data })

  const now = new Date().toISOString()
  const { data: upd, error: updErr } = await supabaseAdmin
    .from('seminar_registrations')
    .update({ checked_in: true, checked_in_at: now, checked_in_by: email })
    .eq('id', (data as any).id)
    .select('*')
    .single()
  if (updErr) return json({ error: updErr.message }, { status: 500 })
  return json({ ok: true, row: upd })
})
