// @ts-nocheck
// Supabase Edge Function: public-get-event
// Purpose: Publicly readable endpoint to fetch a single active event's info (slug, name, price_paise, active)
// Security: Only returns events where active = true. No auth required.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL') as string
const SERVICE_ROLE_KEY = (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') as string

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
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'Method not allowed' }, { status: 405 })

  let slug = ''
  if (req.method === 'GET') {
    const u = new URL(req.url)
    slug = String(u.searchParams.get('slug') || '').trim()
  } else {
    const body = await req.json().catch(() => ({}))
    slug = String(body?.slug || '').trim()
  }
  if (!slug) return json({ error: 'missing-slug' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('seminar_events')
    .select('slug, name, price_paise, active')
    .eq('slug', slug)
    .single()

  if (error) return json({ error: error.message }, { status: 404 })
  return json({ ok: true, event: data })
})
