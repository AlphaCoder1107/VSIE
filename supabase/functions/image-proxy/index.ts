// @ts-nocheck
// Supabase Edge Function: image-proxy
// Fetches remote images (or resolves og:image of a page URL) and serves them with permissive CORS.
// Usage:
//   GET /functions/v1/image-proxy?url=<image_or_page_url>
// Notes:
// - For page URLs (HTML), it will resolve <meta property="og:image"> or common alternatives.
// - Adds Cache-Control: public, max-age=600 to reduce latency without staleness.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const SUPABASE_URL = (globalThis as any).Deno?.env.get('SUPABASE_URL') as string
const SERVICE_ROLE_KEY = (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

function corsHeaders(init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  return headers
}

function isProbablyHtml(contentType?: string | null) {
  return !!contentType && /text\/html|application\/xhtml\+xml/i.test(contentType)
}

async function fetchWithUA(url: string) {
  let referer = 'https://www.google.com/'
  try { referer = new URL(url).origin + '/' } catch {}
  return await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en',
      'Referer': referer,
      'Cache-Control': 'no-cache'
    },
    redirect: 'follow'
  })
}

async function resolveOgImage(pageUrl: string): Promise<string | null> {
  const resp = await fetchWithUA(pageUrl)
  const ct = resp.headers.get('content-type')
  if (!resp.ok) return null
  if (!isProbablyHtml(ct)) return pageUrl // actually an image URL
  const html = await resp.text()
  const candidates = [
    /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)/i,
    /<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)/i,
    /<meta[^>]+property=["']og:image:url["'][^>]*content=["']([^"']+)/i
  ]
  for (const re of candidates) {
    const m = html.match(re)
    if (m?.[1]) return new URL(m[1], pageUrl).toString()
  }
  return null
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders() })

  const u = new URL(req.url)
  const target = u.searchParams.get('url')
  if (!target) return new Response('Missing url', { status: 400, headers: corsHeaders() })

  try {
    let imgUrl = target
    // If it's a page URL, try to resolve og:image
    const headResp = await fetchWithUA(imgUrl)
    const isHtml = isProbablyHtml(headResp.headers.get('content-type'))
    if (isHtml) {
      const og = await resolveOgImage(imgUrl)
      if (og) imgUrl = og
    }

    // Special handling for this project's Supabase Storage public URLs
    try {
      const t = new URL(imgUrl)
      const projectHost = new URL(SUPABASE_URL).host
      if (t.host === projectHost && t.pathname.startsWith('/storage/v1/object/public/')) {
        // Extract bucket and object path
        const parts = t.pathname.replace('/storage/v1/object/public/', '').split('/')
        const bucket = parts.shift() || ''
        const objectPath = decodeURIComponent(parts.join('/'))
        if (bucket && objectPath) {
          const { data: signed, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(objectPath, 3600)
          if (!error && signed?.signedUrl) {
            imgUrl = signed.signedUrl
          }
        }
      }
    } catch { /* ignore and continue with original imgUrl */ }

    const resp = await fetchWithUA(imgUrl)
    if (!resp.ok) return new Response('Fetch failed', { status: 502, headers: corsHeaders() })

  const headers = corsHeaders({ headers: resp.headers })
  headers.set('Cache-Control', 'public, max-age=600')
  // Normalize content-type for images
  const ct = (resp.headers.get('content-type') || '').split(';')[0] || 'image/jpeg'
    headers.set('Content-Type', ct)
    // Remove security headers that might block fetch
    headers.delete('content-security-policy')
    headers.delete('content-security-policy-report-only')

    const body = await resp.arrayBuffer()
    return new Response(body, { status: 200, headers })
  } catch (e) {
    return new Response('Error: ' + (e?.message || 'unknown'), { status: 500, headers: corsHeaders() })
  }
})
