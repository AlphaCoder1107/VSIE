// Supabase Edge Function: verify-recaptcha
// Verifies Google reCAPTCHA v3 token server-side and returns success/score

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RECAPTCHA_SECRET = (globalThis as any).Deno?.env.get('RECAPTCHA_SECRET')
const MIN_SCORE = Number(((globalThis as any).Deno?.env.get('RECAPTCHA_MIN_SCORE')) ?? '0.5')
const ALLOWED_HOSTS: string[] = String(((globalThis as any).Deno?.env.get('RECAPTCHA_ALLOWED_HOSTS')) || '')
  .split(',')
  .map((s: string) => s.trim().toLowerCase())
  .filter((s: string) => !!s)

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
  try {
    const { token, action } = await req.json().catch(() => ({}))
    if (!token) return json({ success: false, error: 'missing-token' }, { status: 400 })
    const result = await verifyToken(token)
    // Validate action (if provided by client) and hostname (if allowlist configured)
    const scoreOk = (typeof result?.score !== 'number') || (result.score >= MIN_SCORE)
    const actionOk = !action || (String(result?.action || '').toLowerCase() === String(action).toLowerCase())
    const host = String(result?.hostname || '').toLowerCase()
    const hostOk = (ALLOWED_HOSTS.length === 0) || ALLOWED_HOSTS.includes(host)
    const success = Boolean(result?.success) && scoreOk && actionOk && hostOk
    return json({
      success,
      score: result?.score ?? null,
      threshold: MIN_SCORE,
      action: result?.action ?? null,
      hostname: host || null,
      reasons: {
        scoreOk,
        actionOk,
        hostOk
      }
    })
  } catch (e) {
    return json({ success: false, error: String(e) }, { status: 500 })
  }
})
