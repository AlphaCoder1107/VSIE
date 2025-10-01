// @ts-nocheck
// Supabase Edge Function: ops-upload-image
// Manager-only: Upload an image to Storage and return a public URL

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL') as string
const SERVICE_ROLE_KEY = (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const DEFAULT_BUCKET = 'events'
const MANAGER_EMAILS: string[] = String(((globalThis as any).Deno?.env.get('EVENT_MANAGER_EMAILS')) || '')
  .split(',').map((s: string) => s.trim().toLowerCase()).filter((s: string) => !!s)

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

function cors(init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  return headers
}

function json(body: any, init: ResponseInit = {}) {
  const headers = cors(init)
  headers.set('Content-Type', 'application/json')
  headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(body), { ...init, headers })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors() })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })

  // Auth
  const auth = req.headers.get('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return json({ error: 'Unauthorized' }, { status: 401 })
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userData?.user?.email) return json({ error: 'Unauthorized' }, { status: 401 })
  const email = String(userData.user.email).toLowerCase()
  if (MANAGER_EMAILS.length && !MANAGER_EMAILS.includes(email)) return json({ error: 'Forbidden' }, { status: 403 })

  // Parse multipart form
  const contentType = req.headers.get('content-type') || ''
  if (!contentType.includes('multipart/form-data')) return json({ error: 'expected-multipart' }, { status: 400 })
  const form = await req.formData()
  const file = form.get('file') as File | null
  const slug = String(form.get('slug') || '').trim()
  const bucket = String(form.get('bucket') || DEFAULT_BUCKET)
  if (!file) return json({ error: 'missing-file' }, { status: 400 })
  if (!slug) return json({ error: 'missing-slug' }, { status: 400 })

  const ext = (file.name?.split('.')?.pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const key = `events/${slug}/cover.${ext}`

  const { data, error } = await supabaseAdmin.storage.from(bucket).upload(key, await file.arrayBuffer(), {
    contentType: file.type || `image/${ext}`,
    cacheControl: '3600',
    upsert: true
  })
  if (error) return json({ error: error.message }, { status: 400 })

  const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(data.path)
  return json({ ok: true, bucket, path: data.path, publicUrl: pub?.publicUrl })
})
