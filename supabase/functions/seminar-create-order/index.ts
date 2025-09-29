// @ts-nocheck
// Supabase Edge Function: seminar-create-order
// Purpose: Create a Razorpay order for seminar registration and return order + key_id

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RAZORPAY_KEY_ID = (globalThis as any).Deno?.env.get('RAZORPAY_KEY_ID') as string
const RAZORPAY_KEY_SECRET = (globalThis as any).Deno?.env.get('RAZORPAY_KEY_SECRET') as string

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
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return json({ error: 'Razorpay not configured' }, { status: 500 })
    }

    const { amount_paise = 1000, receipt = null } = await req.json().catch(() => ({})) as { amount_paise?: number; receipt?: string | null }

    const orderPayload = {
      amount: amount_paise,
      currency: 'INR',
      receipt: receipt || `sem-${Date.now()}`,
      payment_capture: 1
    }

    const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    })

    const data = await r.json()
    if (!r.ok) return json({ error: 'Razorpay order creation failed', details: data }, { status: 500 })
    return json({ order: data, key_id: RAZORPAY_KEY_ID })
  } catch (err: any) {
    return json({ error: 'Internal error', details: err?.message || String(err) }, { status: 500 })
  }
})
