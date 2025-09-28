// Supabase Edge Function: verify-recaptcha
// Verifies Google reCAPTCHA v3 token server-side and returns success/score

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RECAPTCHA_SECRET = Deno.env.get('RECAPTCHA_SECRET')

async function verifyToken(token: string) {
  if (!RECAPTCHA_SECRET) return { success: false, error: 'missing-secret' }
  const params = new URLSearchParams()
  params.set('secret', RECAPTCHA_SECRET)
  params.set('response', token)
  try {
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })
    const data = await resp.json()
    return data
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  return new Response(JSON.stringify(body), { ...init, headers })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
  try {
    const { token } = await req.json().catch(() => ({}))
    if (!token) return json({ success: false, error: 'missing-token' }, { status: 400 })
    const result = await verifyToken(token)
    // Optional: enforce a minimum score threshold, e.g., 0.5
    const success = Boolean(result?.success) && (typeof result?.score !== 'number' || result.score >= 0.5)
    return json({ success, score: result?.score ?? null })
  } catch (e) {
    return json({ success: false, error: String(e) }, { status: 500 })
  }
})
