// @ts-nocheck
// Supabase Edge Function: admin-diagnostics
// Purpose: Admin-only health check for critical services: Supabase DB, functions, and Razorpay.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL') as string
const SERVICE_ROLE_KEY = (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const ADMIN_EMAILS: string[] = String(((globalThis as any).Deno?.env.get('ADMIN_EMAILS')) || '')
  .split(',').map((s: string) => s.trim().toLowerCase()).filter((s: string) => !!s)
const RAZORPAY_KEY_ID = (globalThis as any).Deno?.env.get('RAZORPAY_KEY_ID') as string | undefined
const RAZORPAY_KEY_SECRET = (globalThis as any).Deno?.env.get('RAZORPAY_KEY_SECRET') as string | undefined

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

  // Auth: admin-only
  const auth = req.headers.get('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return json({ error: 'Unauthorized' }, { status: 401 })
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userData?.user?.email) return json({ error: 'Unauthorized' }, { status: 401 })
  const email = userData.user.email.toLowerCase()
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(email)) return json({ error: 'Forbidden' }, { status: 403 })

  // Optional inputs
  let slug = ''
  try {
    if (req.method === 'GET') {
      const u = new URL(req.url)
      slug = String(u.searchParams.get('slug') || '').trim()
    } else {
      const body = await req.json().catch(() => ({}))
      slug = String(body?.slug || '').trim()
    }
  } catch (_) {}

  const report: any = { ok: true, checks: [] as any[] }

  // 1) Supabase DB connectivity: simple select from seminar_events limited
  try {
    const { data, error } = await supabaseAdmin.from('seminar_events').select('slug').limit(1)
    report.checks.push({ name: 'db:seminar_events', ok: !error, error: error?.message || null, sample: data?.[0]?.slug || null })
    if (error) report.ok = false
  } catch (e) { report.checks.push({ name: 'db:seminar_events', ok: false, error: String(e) }); report.ok = false }

  // 2) Razorpay credentials presence and a lightweight API ping
  if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
    try {
      const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
      // do a tiny, harmless list with small page size
      const r = await fetch('https://api.razorpay.com/v1/orders?count=1', { headers: { Authorization: `Basic ${basicAuth}` } })
      const ok = r.status === 200
      let body: any = null
      try { body = await r.json() } catch {}
      report.checks.push({ name: 'razorpay:orders-list', ok, status: r.status, hasItems: !!body?.items?.length })
      if (!ok) report.ok = false
    } catch (e) { report.checks.push({ name: 'razorpay:orders-list', ok: false, error: String(e) }); report.ok = false }
  } else {
    report.checks.push({ name: 'razorpay:env', ok: false, error: 'Missing RAZORPAY_KEY_ID/SECRET' })
    report.ok = false
  }

  // 3) Functions reachability (public-get-event)
  try {
    if (slug) {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/public-get-event?slug=${encodeURIComponent(slug)}`, {
        headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
      })
      const ok = r.ok
      report.checks.push({ name: 'function:public-get-event', ok, status: r.status })
      if (!ok) report.ok = false
    } else {
      report.checks.push({ name: 'function:public-get-event', ok: true, note: 'skipped (no slug provided)' })
    }
  } catch (e) { report.checks.push({ name: 'function:public-get-event', ok: false, error: String(e) }); report.ok = false }

  // 4) Optional: tiny dummy create-order (1 paise) to check credentials end-to-end (not chargeable; order only)
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/seminar-create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ amount_paise: 1, receipt: `diag-${Date.now()}` })
    })
    const body = await r.json().catch(()=>null)
    const ok = r.ok && !!body?.order?.id && !!body?.key_id
    report.checks.push({ name: 'function:seminar-create-order', ok, status: r.status, orderOk: !!body?.order?.id })
    if (!ok) report.ok = false
  } catch (e) { report.checks.push({ name: 'function:seminar-create-order', ok: false, error: String(e) }); report.ok = false }

  return json(report)
})
