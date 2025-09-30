// @ts-nocheck
// Supabase Edge Function: admin-resend-seminar-ticket
// Admin-only: Resends a seminar registration ticket email (ensures QR exists, regenerates signed URL)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'
import QRCode from 'https://esm.sh/qrcode@1.5.3'

const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL') as string
const SERVICE_ROLE_KEY = (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const ADMIN_EMAILS: string[] = String(((globalThis as any).Deno?.env.get('ADMIN_EMAILS')) || '')
  .split(',').map((s: string) => s.trim().toLowerCase()).filter((s: string) => !!s)
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
  return new Response(JSON.stringify(body), { ...init, headers })
}

function sanitizeFileName(s: string) { return String(s || '').replace(/[^a-z0-9-_\.]/gi, '-') }
async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  const base64 = dataUrl.split(',')[1] || ''
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}
function buildQrPayload(row: any) {
  if (VERIFY_BASE_URL) {
    const url = new URL(VERIFY_BASE_URL)
    url.searchParams.set('code', String(row.registration_code))
    url.searchParams.set('id', String(row.id))
    return url.toString()
  }
  return JSON.stringify({ id: row.id, code: row.registration_code, name: row.student_name, email: row.student_email })
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

  const { id } = await req.json().catch(() => ({})) as { id?: number }
  if (!id) return json({ error: 'missing-id' }, { status: 400 })

  // 1) Load registration
  const { data: row, error } = await supabaseAdmin
    .from('seminar_registrations')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) return json({ error: error.message }, { status: 500 })
  if (!row) return json({ error: 'not-found' }, { status: 404 })

  // 2) Ensure QR exists and get URL
  let qrUrl = row.qr_url as string | undefined
  let pngBytes: Uint8Array | null = null
  if (!qrUrl) {
    const payload = buildQrPayload(row)
    try {
      const dataUrl = await QRCode.toDataURL(payload, { type: 'image/png', width: 320 })
      pngBytes = await dataUrlToBytes(dataUrl)
    } catch (_) {
      const api = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(payload)}`
      const r = await fetch(api)
      if (!r.ok) return json({ error: 'qr-api-failed', status: r.status }, { status: 500 })
      const ab = await r.arrayBuffer(); pngBytes = new Uint8Array(ab)
    }
    if (!STORAGE_BUCKET) return json({ error: 'no-bucket' }, { status: 500 })
    const year = new Date().getFullYear()
    const code = row.registration_code || `reg-${row.id}`
    const filePath = `registrations/${year}/${sanitizeFileName(code)}.png`
    const blob = new Blob([pngBytes], { type: 'image/png' })
    const { error: upErr } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(filePath, blob, { contentType: 'image/png', upsert: true })
    if (upErr) return json({ error: upErr.message }, { status: 500 })
    try {
      const { data: signed } = await supabaseAdmin.storage.from(STORAGE_BUCKET).createSignedUrl(filePath, 60 * 60 * 24 * 30)
      qrUrl = signed?.signedUrl
    } catch (_) {}
    if (!qrUrl) qrUrl = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(filePath).publicURL
    await supabaseAdmin.from('seminar_registrations').update({ qr_url: qrUrl, qr_generated: true, qr_generated_at: new Date().toISOString() }).eq('id', id)
  }

  // 3) Send email via SendGrid
  if (!(SENDGRID_API_KEY && EMAIL_FROM)) return json({ error: 'email-not-configured', ok: false }, { status: 500 })
  const subject = `Your VIC Ticket - ${row.registration_code}`
  const html = `
    <p>Hi ${row.student_name || 'Participant'},</p>
    <p>Thanks for registering for <b>${row.event_slug}</b>.</p>
    <p>Your registration code: <b>${row.registration_code}</b></p>
    <p><img src="cid:qr-image" alt="QR" style="max-width:320px"/></p>
    <p>Present this QR at the entry. Keep this email handy on event day.</p>
    <p>If the image doesn't load, your QR is attached as a PNG and available at: ${qrUrl}</p>
  `
  const text = `Hi ${row.student_name || 'Participant'},\n\nThanks for registering for ${row.event_slug}.\nYour registration code: ${row.registration_code}.\nOpen this link to view your QR: ${qrUrl}\n\nPresent this at entry.\n`

  let attachContent: string | undefined
  if (pngBytes) attachContent = btoa(String.fromCharCode(...pngBytes))
  else if (qrUrl) {
    try { const r = await fetch(qrUrl); const ab = await r.arrayBuffer(); attachContent = btoa(String.fromCharCode(...new Uint8Array(ab))) } catch { /* ignore */ }
  }

  const payload: any = {
    personalizations: [{ to: [{ email: row.student_email }] }],
    from: EMAIL_FROM_NAME ? { email: EMAIL_FROM, name: EMAIL_FROM_NAME } : { email: EMAIL_FROM },
    subject,
    content: [ { type: 'text/plain', value: text }, { type: 'text/html', value: html } ],
    attachments: attachContent ? [
      { content: attachContent, filename: `${sanitizeFileName(row.registration_code || `reg-${row.id}`)}.png`, type: 'image/png', disposition: 'inline', content_id: 'qr-image' },
      { content: attachContent, filename: `${sanitizeFileName(row.registration_code || `reg-${row.id}`)}.png`, type: 'image/png', disposition: 'attachment' }
    ] : undefined,
    tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } }
  }
  if (REPLY_TO) payload.reply_to = { email: REPLY_TO }

  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const ok = resp.ok
  let bodyText = ''
  if (!ok) { try { bodyText = await resp.text() } catch {} }
  return json({ ok, status: resp.status, error: ok ? undefined : bodyText, qrUrl })
})
