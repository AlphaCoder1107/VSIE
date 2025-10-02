// @ts-nocheck
// Supabase Edge Function: seminar-register-free
// Purpose: Create a free seminar registration (no payment), generate QR, and email the ticket.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'
import QRCode from 'https://esm.sh/qrcode@1.5.3'

const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL') as string
const SERVICE_ROLE_KEY = (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const RECAPTCHA_SECRET = (globalThis as any).Deno?.env.get('RECAPTCHA_SECRET') as string | undefined
const ENFORCE_RECAPTCHA = String((globalThis as any).Deno?.env.get('ENFORCE_RECAPTCHA') || '').toLowerCase() === 'true'
const STORAGE_BUCKET = (globalThis as any).Deno?.env.get('STORAGE_BUCKET') as string | undefined
const SENDGRID_API_KEY = (globalThis as any).Deno?.env.get('SENDGRID_API_KEY') as string | undefined
const EMAIL_FROM = (globalThis as any).Deno?.env.get('EMAIL_FROM') as string | undefined
const EMAIL_FROM_NAME = (globalThis as any).Deno?.env.get('EMAIL_FROM_NAME') as string | undefined
const REPLY_TO = (globalThis as any).Deno?.env.get('REPLY_TO') as string | undefined
const VERIFY_BASE_URL = (globalThis as any).Deno?.env.get('VERIFY_BASE_URL') as string | undefined

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

function buildQrPayload(row: any) {
  if (VERIFY_BASE_URL) {
    const url = new URL(VERIFY_BASE_URL)
    url.searchParams.set('code', String(row.registration_code))
    url.searchParams.set('id', String(row.id))
    return url.toString()
  }
  // Default to the site ticket route for a short, trusted link
  const base = 'https://vic.college/ticket/'
  const url = new URL(base)
  url.searchParams.set('code', String(row.registration_code))
  url.searchParams.set('id', String(row.id))
  return url.toString()
}

function sanitizeFileName(s: string) {
  return String(s || '').replace(/[^a-z0-9-_\.]/gi, '-')
}

async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  const base64 = dataUrl.split(',')[1] || ''
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function uploadQrAndEmail({ id, registration_code, student_email, student_name, event_slug }: any) {
  if (!STORAGE_BUCKET) return { uploaded: false, emailed: false }
  const payload = buildQrPayload({ id, registration_code, student_name, student_email })
  let pngBytes: Uint8Array | null = null
  try {
    const dataUrl = await QRCode.toDataURL(payload, { type: 'image/png', width: 320 })
    pngBytes = await dataUrlToBytes(dataUrl)
  } catch (_) {}
  if (!pngBytes) {
    const api = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(payload)}`
    const r = await fetch(api)
    if (!r.ok) throw new Error('QR API failed')
    const ab = await r.arrayBuffer()
    pngBytes = new Uint8Array(ab)
  }
  const year = new Date().getFullYear()
  const code = registration_code || `reg-${id}`
  const filePath = `registrations/${year}/${sanitizeFileName(code)}.png`
  const blob = new Blob([pngBytes], { type: 'image/png' })
  await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(filePath, blob, { contentType: 'image/png', upsert: true })
  let qrUrl: string | undefined
  try {
    const { data: signed } = await supabaseAdmin.storage.from(STORAGE_BUCKET).createSignedUrl(filePath, 60 * 60 * 24 * 30)
    qrUrl = signed?.signedUrl
  } catch (_) {}
  if (!qrUrl) qrUrl = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(filePath).publicURL
  try {
    await supabaseAdmin.from('seminar_registrations').update({ qr_url: qrUrl, qr_generated: true, qr_generated_at: new Date().toISOString() }).eq('id', id)
  } catch (_) {}
  let emailed = false
  if (SENDGRID_API_KEY && EMAIL_FROM && student_email) {
    const subject = `Your VIC Ticket - ${code}`
    // Prefer short on-site ticket URL to reduce spam flags from very long signed URLs
    const webTicketUrl = buildQrPayload({ id, registration_code, student_name, student_email })
    const html = `
      <p>Hi ${student_name || 'Participant'},</p>
      <p>Thanks for registering for <b>${event_slug}</b> (free entry).</p>
      <p>Your registration code: <b>${code}</b></p>
      <p><img src="cid:qr-image" alt="QR" style="max-width:320px"/></p>
      <p>Alternatively, you can open your ticket here: <a href="${webTicketUrl}">View ticket</a></p>
      <p>Keep this link private and present the QR at entry.</p>
    `
    const text = `Hi ${student_name || 'Participant'},\nThanks for registering for ${event_slug}.\nYour registration code: ${code}.\nOpen your ticket: ${webTicketUrl}\nKeep this link private and present the QR at entry.`
    const payload: any = {
      personalizations: [{ to: [{ email: student_email }] }],
      from: EMAIL_FROM_NAME ? { email: EMAIL_FROM, name: EMAIL_FROM_NAME } : { email: EMAIL_FROM },
      subject,
      content: [ { type: 'text/plain', value: text }, { type: 'text/html', value: html } ],
      // Send a single inline image (no duplicate attachment) to reduce size and spam likelihood
      attachments: [
        { content: btoa(String.fromCharCode(...pngBytes)), filename: `${sanitizeFileName(code)}.png`, type: 'image/png', disposition: 'inline', content_id: 'qr-image' }
      ],
      tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } }
    }
    if (REPLY_TO) payload.reply_to = { email: REPLY_TO }
    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    emailed = resp.ok
  }
  return { uploaded: true, emailed }
}

async function verifyRecaptcha(_token?: string) {
  // Captcha disabled for this function
  return { ok: true }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Supabase not configured' }, { status: 500 })
    const body = await req.json().catch(() => ({})) as any
    const { student, recaptcha_token } = body || {}
    if (!student) return json({ error: 'Missing student' }, { status: 400 })
    const { name, email, phone, college, year, event_slug } = student || {}
    if (!name || !email) return json({ error: 'Missing name/email' }, { status: 400 })

  const rec = await verifyRecaptcha(recaptcha_token)
  if (!rec.ok) return json({ error: rec.error || 'recaptcha-failed' }, { status: 400 })

    const insertPayload = {
      event_slug: String(event_slug || 'free-event'),
      student_name: String(name || ''),
      student_email: String(email || ''),
      student_phone: phone ? String(phone) : null,
      college: college ? String(college) : null,
      year: year ? String(year) : null,
      amount_paise: 0,
      status: 'free'
    }

    const { data, error } = await supabaseAdmin
      .from('seminar_registrations')
      .insert([insertPayload])
      .select('id, registration_code')
      .single()
    if (error) return json({ error: 'DB insert failed', details: error.message }, { status: 500 })

    try {
      await uploadQrAndEmail({ id: data?.id, registration_code: data?.registration_code, student_email: insertPayload.student_email, student_name: insertPayload.student_name, event_slug: insertPayload.event_slug })
    } catch (_) {}

    return json({ ok: true, registration_code: data?.registration_code, id: data?.id })
  } catch (err: any) {
    return json({ error: 'Internal error', details: err?.message || String(err) }, { status: 500 })
  }
})
