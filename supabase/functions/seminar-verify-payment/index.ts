// @ts-nocheck
// Supabase Edge Function: seminar-verify-payment
// Purpose: Verify Razorpay payment, then insert a registration row in Supabase and return registration_code

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'
// QR generation (Node lib via esm.sh works in Deno with polyfills)
import QRCode from 'https://esm.sh/qrcode@1.5.3'
import { jsPDF } from 'https://esm.sh/jspdf@2.5.1'
import autoTable from 'https://esm.sh/jspdf-autotable@3.5.28'

const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL') as string
const SERVICE_ROLE_KEY = (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const RAZORPAY_KEY_ID = (globalThis as any).Deno?.env.get('RAZORPAY_KEY_ID') as string
const RAZORPAY_KEY_SECRET = (globalThis as any).Deno?.env.get('RAZORPAY_KEY_SECRET') as string
// New: QR/Email env
const STORAGE_BUCKET = (globalThis as any).Deno?.env.get('STORAGE_BUCKET') as string | undefined
const SENDGRID_API_KEY = (globalThis as any).Deno?.env.get('SENDGRID_API_KEY') as string | undefined
const EMAIL_FROM = (globalThis as any).Deno?.env.get('EMAIL_FROM') as string | undefined
const EMAIL_FROM_NAME = (globalThis as any).Deno?.env.get('EMAIL_FROM_NAME') as string | undefined
const REPLY_TO = (globalThis as any).Deno?.env.get('REPLY_TO') as string | undefined
const VERIFY_BASE_URL = (globalThis as any).Deno?.env.get('VERIFY_BASE_URL') as string | undefined
const TICKET_URL_BASE = (globalThis as any).Deno?.env.get('TICKET_URL_BASE') as string | undefined
const SEPARATE_RECEIPT_EMAIL = String(((globalThis as any).Deno?.env.get('SEPARATE_RECEIPT_EMAIL')) || '').toLowerCase() === 'true'
const ORG_ADDRESS = (globalThis as any).Deno?.env.get('ORG_ADDRESS') as string | undefined
const ORG_GSTIN = (globalThis as any).Deno?.env.get('ORG_GSTIN') as string | undefined

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

function buildQrPayload(row: any) {
  // Prefer a verification URL payload for gate scanning simplicity
  if (VERIFY_BASE_URL) {
    const url = new URL(VERIFY_BASE_URL)
    url.searchParams.set('code', String(row.registration_code))
    url.searchParams.set('id', String(row.id))
    return url.toString()
  }
  // Fallback: compact JSON payload
  return JSON.stringify({ id: row.id, code: row.registration_code, name: row.student_name, email: row.student_email })
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

async function uploadQrAndEmail({ id, registration_code, student_email, student_name, event_slug }: any, extraAttachments?: any[]) {
  if (!STORAGE_BUCKET) return { uploaded: false, emailed: false }
  // 1) Build QR payload and render to PNG data URL
  const payload = buildQrPayload({ id, registration_code, student_name, student_email })
  let pngBytes: Uint8Array | null = null
  try {
    const dataUrl = await QRCode.toDataURL(payload, { type: 'image/png', width: 320 })
    pngBytes = await dataUrlToBytes(dataUrl)
    console.log('[seminar-verify] qr-bytes (local)', { length: pngBytes.length })
  } catch (e) {
    console.log('[seminar-verify] local QR gen failed, falling back', { err: String(e) })
  }
  if (!pngBytes) {
    // Fallback: use an external QR API to get a PNG
    const api = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(payload)}`
    const r = await fetch(api)
    if (!r.ok) throw new Error(`QR API failed (${r.status})`)
    const ab = await r.arrayBuffer()
    pngBytes = new Uint8Array(ab)
    console.log('[seminar-verify] qr-bytes (api)', { length: pngBytes.length })
  }

  // 2) Upload to Supabase Storage
  const year = new Date().getFullYear()
  const code = registration_code || `reg-${id}`
  const filePath = `registrations/${year}/${sanitizeFileName(code)}.png`
  // Use Blob to improve compatibility in Deno runtimes
  const blob = new Blob([pngBytes], { type: 'image/png' })
  const { error: uploadErr } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(filePath, blob, {
    contentType: 'image/png',
    upsert: true
  })
  if (uploadErr) throw uploadErr
  console.log('[seminar-verify] uploaded', { filePath })
  // Prefer signed URL (works with private buckets). Fallback to public URL if signing fails.
  let qrUrl: string | undefined
  try {
    const { data: signed } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, 60 * 60 * 24 * 30) // 30 days
    if (signed?.signedUrl) qrUrl = signed.signedUrl
  } catch (_) {}
  if (!qrUrl) {
    const { publicURL } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(filePath)
    qrUrl = publicURL
  }
  console.log('[seminar-verify] qr-url', { qrUrl: !!qrUrl })

  // 3) Update DB with QR URL and generated flags (if columns exist)
  try {
    await supabaseAdmin
      .from('seminar_registrations')
      .update({ qr_url: qrUrl, qr_generated: true, qr_generated_at: new Date().toISOString() })
      .eq('id', id)
  } catch (_) {
    // ignore if columns not present
  }

  // 4) Send email via SendGrid (optional)
  let emailed = false
  if (SENDGRID_API_KEY && EMAIL_FROM && student_email) {
  const subject = `Your VIC Ticket - ${code}`
    const ticketLink = (TICKET_URL_BASE || 'https://vic.college/ticket') + `?code=${encodeURIComponent(code)}&id=${encodeURIComponent(String(id))}`
    const html = `
      <p>Hi ${student_name || 'Participant'},</p>
      <p>Thanks for registering for <b>${event_slug}</b>.</p>
      <p>Your registration code: <b>${code}</b></p>
      <p><img src="cid:qr-image" alt="QR" style="max-width:320px"/></p>
      <p>Present this QR at the entry. Keep this email handy on event day.</p>
      <p><a href="${ticketLink}">View your ticket online</a> if you need to re-open the QR later.</p>
    `
    const text = `Hi ${student_name || 'Participant'},\n\nThanks for registering for ${event_slug}.\nYour registration code: ${code}.\nView your ticket: ${ticketLink}\n\nPresent this at entry.\n`

    const payload: any = {
      personalizations: [{ to: [{ email: student_email }] }],
      from: EMAIL_FROM_NAME ? { email: EMAIL_FROM, name: EMAIL_FROM_NAME } : { email: EMAIL_FROM },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html }
      ],
      // Inline the QR via CID; attach optional extras (e.g., PDF receipt)
      attachments: [
        {
          content: btoa(String.fromCharCode(...pngBytes)),
          filename: `${sanitizeFileName(code)}.png`,
          type: 'image/png',
          disposition: 'inline',
          content_id: 'qr-image'
        },
        ...(Array.isArray(extraAttachments) ? extraAttachments : [])
      ],
      // Reduce spam signals
      tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } },
      // Mark as transactional in SendGrid
      mail_settings: { bypass_list_management: { enable: true } },
      categories: ['transactional','ticket']
    }
    if (REPLY_TO) payload.reply_to = { email: REPLY_TO }

    console.log('[seminar-verify] email-payload', { from: EMAIL_FROM, to: student_email, replyTo: REPLY_TO || null })

    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    emailed = resp.ok
    if (!resp.ok) {
      let bodyText = ''
      try { bodyText = await resp.text() } catch (_) {}
      console.log('[seminar-verify] email-error', { status: resp.status, body: bodyText?.slice(0, 2000) })
      // Optionally track email failed count
      try {
        await supabaseAdmin
          .from('seminar_registrations')
          .update({ email_failed_count: (1) })
          .eq('id', id)
      } catch (_) {}
    }
    console.log('[seminar-verify] email-sent', { ok: emailed })
  }

  return { uploaded: true, emailed }
}

function formatINR(paise: number) {
  const rupees = Number(paise || 0) / 100
  const str = rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `₹${str}`
}

async function buildReceiptPdf({
  org = EMAIL_FROM_NAME || 'VIC',
  code,
  event_slug,
  amount_paise,
  student_name,
  student_email,
  student_phone,
  razorpay_order_id,
  razorpay_payment_id,
  txn_date
}: any): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = margin

  // Header
  doc.setFontSize(18)
  doc.text(`${org} — Payment Receipt`, margin, y)
  if (ORG_ADDRESS) {
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(ORG_ADDRESS, pageWidth - margin * 2)
    y += 14
    doc.text(lines as unknown as string, margin, y)
  }
  if (ORG_GSTIN) {
    y += 14
    doc.setFontSize(10)
    doc.text(`GSTIN: ${ORG_GSTIN}`, margin, y)
  }
  y += 22

  // Meta boxes: Receipt/Date (left), Billing (right)
  doc.setFontSize(11)
  const boxW = (pageWidth - margin * 2) / 2 - 8
  const metaLeftY = y
  doc.text(`Receipt No: ${code}`, margin, y)
  y += 14
  doc.text(`Date: ${txn_date}`, margin, y)

  // Bill to
  let yRight = metaLeftY
  const rightX = margin + boxW + 16
  doc.text('Bill To:', rightX, yRight)
  yRight += 14
  doc.text(`${student_name || '-'}`, rightX, yRight)
  yRight += 14
  doc.text(`${student_email || '-'}`, rightX, yRight)
  yRight += 14
  if (student_phone) { doc.text(`${student_phone}`, rightX, yRight); yRight += 14 }

  // Move y below the taller of the two columns
  y = Math.max(y, yRight) + 18

  // Items table (single line item)
  const amount = Number(amount_paise || 0) / 100
  const columns = [
    { header: 'S.No', dataKey: 'sno' },
    { header: 'Description', dataKey: 'desc' },
    { header: 'Qty', dataKey: 'qty' },
    { header: 'Unit (₹)', dataKey: 'unit' },
    { header: 'Amount (₹)', dataKey: 'amt' }
  ]
  const rows = [
    { sno: 1, desc: `Event Registration — ${event_slug}`, qty: 1, unit: amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), amt: amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }
  ]
  autoTable(doc, {
    head: [columns.map(c => c.header)],
    body: rows.map(r => [r.sno, r.desc, r.qty, r.unit, r.amt]),
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 11 },
    styles: { fontSize: 10, cellPadding: 6, halign: 'left' },
    columnStyles: {
      0: { halign: 'right', cellWidth: 50 },
      2: { halign: 'right', cellWidth: 60 },
      3: { halign: 'right', cellWidth: 90 },
      4: { halign: 'right', cellWidth: 100 }
    }
  })
  // Totals table aligned to the right
  const afterItemsY = (doc as any).lastAutoTable.finalY + 8
  const totalsWidth = 220
  const totalsX = pageWidth - margin - totalsWidth
  autoTable(doc, {
    body: [
      ['Subtotal', amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })],
      // Add GST row if you later enable taxes
      // ['GST (0%)', '0.00'],
      ['Total', amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })]
    ],
    startY: afterItemsY,
    margin: { left: totalsX, right: margin },
    theme: 'grid',
    styles: { fontSize: 11, cellPadding: 6 },
    columnStyles: { 0: { halign: 'right' }, 1: { halign: 'right' } }
  })

  // Payment information
  const infoY = (doc as any).lastAutoTable.finalY + 18
  doc.setFontSize(11)
  doc.text(`Razorpay Order ID: ${razorpay_order_id}`, margin, infoY)
  doc.text(`Razorpay Payment ID: ${razorpay_payment_id}`, margin, infoY + 14)

  // Footer note
  const footerY = infoY + 40
  doc.setFontSize(9)
  doc.text('This is a system-generated receipt. Please retain for your records.', margin, footerY)

  const ab = doc.output('arraybuffer') as ArrayBuffer
  return new Uint8Array(ab)
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
  try {
    if (!RAZORPAY_KEY_SECRET || !RAZORPAY_KEY_ID) return json({ error: 'Razorpay not configured' }, { status: 500 })
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Supabase not configured' }, { status: 500 })

    const body = await req.json().catch(() => ({})) as any
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, student } = body || {}
    console.log('[seminar-verify] start', { order: razorpay_order_id, payment: razorpay_payment_id, hasStudent: !!student })
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
      console.log('[seminar-verify] not captured', { status: paymentInfo?.status, httpOk: payRes.ok })
      return json({ error: 'Payment not captured', details: paymentInfo }, { status: 400 })
    }
    console.log('[seminar-verify] captured', { amount: paymentInfo?.amount, currency: paymentInfo?.currency })

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

    if (error) {
      console.error('[seminar-verify] DB insert failed', error)
      return json({ error: 'DB insert failed', details: error.message }, { status: 500 })
    }
    console.log('[seminar-verify] inserted', { id: data?.id, code: data?.registration_code })

    // 4) Generate QR, upload. Build receipt, attach to ticket email (or send separately) — best-effort
    try {
      // Build receipt PDF bytes first
      let receiptAttachment: any[] | undefined
      if (SENDGRID_API_KEY && EMAIL_FROM && insertPayload.student_email) {
        try {
          const pdfBytes = await buildReceiptPdf({
            code: data?.registration_code,
            event_slug: insertPayload.event_slug,
            amount_paise: insertPayload.amount_paise,
            student_name: insertPayload.student_name,
            student_email: insertPayload.student_email,
            student_phone: insertPayload.student_phone,
            razorpay_order_id,
            razorpay_payment_id,
            txn_date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          })
          if (!SEPARATE_RECEIPT_EMAIL) {
            receiptAttachment = [{
              content: btoa(String.fromCharCode(...pdfBytes)),
              filename: `receipt_${sanitizeFileName(String(data?.registration_code || 'ticket'))}.pdf`,
              type: 'application/pdf',
              disposition: 'attachment'
            }]
          }
        } catch (e) { console.warn('[seminar-verify] build-receipt failed', e) }
      }

      await uploadQrAndEmail({
        id: data?.id,
        registration_code: data?.registration_code,
        student_email: insertPayload.student_email,
        student_name: insertPayload.student_name,
        event_slug: insertPayload.event_slug
      }, receiptAttachment)

      // If configured, also send a separate receipt email (in addition to attachment above)
      if (SEPARATE_RECEIPT_EMAIL && SENDGRID_API_KEY && EMAIL_FROM && insertPayload.student_email && receiptAttachment?.[0]) {
        const basePayload: any = {
          personalizations: [{ to: [{ email: insertPayload.student_email }] }],
          from: EMAIL_FROM_NAME ? { email: EMAIL_FROM, name: EMAIL_FROM_NAME } : { email: EMAIL_FROM },
          subject: `Payment Receipt — ${data?.registration_code}`,
          content: [
            { type: 'text/plain', value: `Thanks for your payment for ${insertPayload.event_slug}. Receipt attached. Registration code: ${data?.registration_code}.` },
            { type: 'text/html', value: `<p>Thanks for your payment for <b>${insertPayload.event_slug}</b>.</p><p>Registration code: <b>${data?.registration_code}</b></p><p>Receipt attached as PDF.</p>` }
          ],
          attachments: receiptAttachment,
          tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } },
          mail_settings: { bypass_list_management: { enable: true } },
          categories: ['transactional','receipt']
        }
        if (REPLY_TO) basePayload.reply_to = { email: REPLY_TO }
        await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(basePayload)
        })
      }
    } catch (postErr) {
      // log and continue; payment is already successful and row inserted
      console.error('[seminar-verify] post-process failed', postErr)
    }

    return json({ ok: true, registration_code: data?.registration_code, id: data?.id })
  } catch (err: any) {
    return json({ error: 'Internal error', details: err?.message || String(err) }, { status: 500 })
  }
})
