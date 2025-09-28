// Supabase Edge Function: admin-get-application
// Returns a single application by id using service role, restricted to admin emails.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL') as string
const SERVICE_ROLE_KEY = (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const ADMIN_EMAILS: string[] = String(((globalThis as any).Deno?.env.get('ADMIN_EMAILS')) || '')
  .split(',').map((s: string) => s.trim().toLowerCase()).filter((s: string) => !!s)
const BUCKET = ((globalThis as any).Deno?.env.get('SUPABASE_BUCKET') as string) || 'attachments'

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

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userData?.user?.email) return json({ error: 'Unauthorized' }, { status: 401 })
  const email = userData.user.email.toLowerCase()
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(email)) return json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json().catch(() => ({})) as { id?: number }
  if (!id) return json({ error: 'missing-id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('applications')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) return json({ error: error.message }, { status: 500 })
  if (!data) return json({ error: 'not-found' }, { status: 404 })

  // Create short-lived signed URLs for attachments if present
  const attachments = (data as any).attachments || {}
  const signed: Record<string, string> = {}
  try {
    for (const [key, path] of Object.entries(attachments)) {
      if (typeof path === 'string' && path.length > 0) {
        const { data: s, error: e } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 600) // 10 min
        if (!e && s?.signedUrl) signed[key] = s.signedUrl
      }
    }
  } catch {
    // ignore
  }

  return json({ row: { ...data, attachments_signed: signed } })
})
