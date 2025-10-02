// @ts-nocheck
// Supabase Edge Function: admin-list-seminars
// Lists seminar registrations using service role, restricted to authenticated admin emails.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL') as string
const SERVICE_ROLE_KEY = (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const ADMIN_EMAILS: string[] = String(((globalThis as any).Deno?.env.get('ADMIN_EMAILS')) || '')
  .split(',')
  .map((s: string) => s.trim().toLowerCase())
  .filter((s: string) => !!s)

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

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

  const auth = req.headers.get('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return json({ error: 'Unauthorized' }, { status: 401 })

  // Verify user and allow only configured admin emails
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userData?.user?.email) return json({ error: 'Unauthorized' }, { status: 401 })
  const email = userData.user.email.toLowerCase()
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(email)) {
    return json({ error: 'Forbidden' }, { status: 403 })
  }

  const { limit = 200, offset = 0, query = '', event_slug = '' } = await req.json().catch(() => ({})) as { limit?: number; offset?: number; query?: string; event_slug?: string }

  const safeLimit = Math.max(1, Math.min(1000, limit))
  let builder = supabaseAdmin
    .from('seminar_registrations')
    .select('id, created_at, registration_code, event_slug, student_name, student_email, student_phone, college, year, amount_paise, status, qr_url, qr_generated, qr_generated_at, checked_in, checked_in_at')
    .order('created_at', { ascending: false })

  const slug = String(event_slug || '').trim()
  if (slug) builder = builder.eq('event_slug', slug)

  const q = String(query || '').trim()
  if (q.length > 0) {
    const isNum = /^\d+$/.test(q)
    const like = `%${q}%`
    const orFilters = [
      `registration_code.ilike.${like}`,
      `student_name.ilike.${like}`,
      `student_email.ilike.${like}`,
      `student_phone.ilike.${like}`,
      `event_slug.ilike.${like}`
    ]
    if (isNum) orFilters.push(`id.eq.${Number(q)}`)
    builder = builder.or(orFilters.join(','))
  }

  const { data, error } = await builder.range(offset, offset + safeLimit - 1)
  if (error) return json({ error: error.message }, { status: 500 })
  return json({ rows: data || [] })
})
