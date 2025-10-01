// @ts-nocheck
// Supabase Edge Function: ops-upsert-event
// Manager-only: create/update events in public.seminar_events

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL') as string
const SERVICE_ROLE_KEY = (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const MANAGER_EMAILS: string[] = String(((globalThis as any).Deno?.env.get('EVENT_MANAGER_EMAILS')) || '')
  .split(',').map((s: string) => s.trim().toLowerCase()).filter((s: string) => !!s)

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  headers.set('Cache-Control', 'no-store')
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
  if (MANAGER_EMAILS.length > 0 && !MANAGER_EMAILS.includes(email)) return json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  let { slug, name, price_paise, active, image_url, title, excerpt, date, location } = body || {}
  slug = (slug || '').trim()
  if (!slug) return json({ error: 'missing-slug' }, { status: 400 })
  if (price_paise != null) price_paise = Number(price_paise) || 0
  if (active == null) active = true
  active = !!active

  const payload: any = { slug, name, price_paise, active }
  if (image_url !== undefined) payload.image_url = String(image_url)
  if (title !== undefined) payload.title = String(title)
  if (excerpt !== undefined) payload.excerpt = String(excerpt)
  if (date !== undefined) payload.date = String(date)
  if (location !== undefined) payload.location = String(location)

  const { data, error } = await supabaseAdmin
    .from('seminar_events')
    .upsert(payload, { onConflict: 'slug' })
    .select('slug, name, price_paise, active, created_at, image_url, title, excerpt, date, location')
    .single()
  if (error) return json({ error: error.message }, { status: 500 })
  return json({ ok: true, event: data })
})
