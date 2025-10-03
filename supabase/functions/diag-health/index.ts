// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Cache-Control', 'no-store')
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  return new Response(JSON.stringify(body), { ...init, headers })
}

const VERSION = (globalThis as any).Deno?.env.get('RELEASE') || ''
const PROJECT = (globalThis as any).Deno?.env.get('PROJECT_REF') || ''

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, { status: 405 })
  return json({ ok: true, version: VERSION, projectRef: PROJECT, time: new Date().toISOString() })
})
