// @ts-nocheck
// Supabase Edge Function: public-list-events
// Purpose: Public endpoint to list active events for public pages

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
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })

  let limit = 50
  try {
    if (req.method === 'POST') {
      const body = await req.json()
      if (Number.isFinite(body?.limit)) limit = Math.max(1, Math.min(200, Number(body.limit)))
    }
  } catch {}

  const missingCol = (msg: string) => /does not exist/i.test(msg) || /schema cache/i.test(msg) || /Could not find the '.+?' column/i.test(msg)
  async function runSelect(full: boolean) {
    let sel = 'slug, name, price_paise, active'
    if (full) sel += ', image_url, date, location, excerpt, title'
    let q = supabaseAdmin
      .from('seminar_events')
      .select(sel)
      .eq('active', true)
    // Prefer ordering by date if available, else created_at
    if (full) q = q.order('date', { ascending: true, nullsFirst: false })
    else q = q.order('created_at', { ascending: true })
    return q.limit(limit)
  }

  let { data, error } = await runSelect(true)
  if (error && missingCol(error.message || '')) {
    const { data: d2, error: e2 } = await runSelect(false)
    if (e2) return json({ error: e2.message }, { status: 500 })
    data = d2
  } else if (error) {
    return json({ error: error.message }, { status: 500 })
  }
  return json({ ok: true, events: data || [] })
})
