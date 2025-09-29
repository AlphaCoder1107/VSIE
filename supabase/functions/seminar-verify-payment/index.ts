// @ts-nocheck
// Supabase Edge Function: seminar-verify-payment
// Purpose: Verify Razorpay payment, then insert a registration row in Supabase and return registration_code

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL') as string
const SERVICE_ROLE_KEY = (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const RAZORPAY_KEY_ID = (globalThis as any).Deno?.env.get('RAZORPAY_KEY_ID') as string
const RAZORPAY_KEY_SECRET = (globalThis as any).Deno?.env.get('RAZORPAY_KEY_SECRET') as string

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  return new Response(JSON.stringify(body), { ...init, headers })
}

async function hmacSha256Hex(key: string, data: string) {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data))
  const bytes = new Uint8Array(sigBuf as ArrayBuffer)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
  try {
    if (!RAZORPAY_KEY_SECRET || !RAZORPAY_KEY_ID) return json({ error: 'Razorpay not configured' }, { status: 500 })
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Supabase not configured' }, { status: 500 })

    const body = await req.json().catch(() => ({})) as any
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, student } = body || {}
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !student) {
      return json({ error: 'Missing parameters' }, { status: 400 })
    }

    // 1) Verify signature
    const expected = await hmacSha256Hex(RAZORPAY_KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`)
    if (expected !== String(razorpay_signature)) {
      return json({ error: 'Invalid signature — payment verification failed' }, { status: 400 })
    }

    // 2) Verify payment is captured with Razorpay
    const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
    const payRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: { Authorization: `Basic ${basicAuth}` }
    })
    const paymentInfo = await payRes.json()
    if (!payRes.ok || (paymentInfo?.status !== 'captured')) {
      return json({ error: 'Payment not captured', details: paymentInfo }, { status: 400 })
    }

    // 3) Insert registration row
    const insertPayload = {
      event_slug: String(student.event_slug || 'friday-seminar'),
      student_name: String(student.name || ''),
      student_email: String(student.email || ''),
      student_phone: student.phone ? String(student.phone) : null,
      college: student.college ? String(student.college) : null,
      year: student.year ? String(student.year) : null,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount_paise: Number(paymentInfo?.amount ?? 1000),
      status: 'paid'
    }

    const { data, error } = await supabaseAdmin
      .from('seminar_registrations')
      .insert([insertPayload])
      .select('id, registration_code')
      .single()

    if (error) return json({ error: 'DB insert failed', details: error.message }, { status: 500 })

    return json({ ok: true, registration_code: data?.registration_code, id: data?.id })
  } catch (err: any) {
    return json({ error: 'Internal error', details: err?.message || String(err) }, { status: 500 })
  }
})
