// Supabase Edge Function: get-application-code
// Returns application_code for a submission identified by client_ref.
// Uses service role inside the function to bypass RLS safely.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  return new Response(JSON.stringify(body), { ...init, headers })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return json({ ok: true })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const { client_ref } = await req.json().catch(() => ({}))
    if (!client_ref) {
      return json({ error: 'client_ref is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('applications')
      .select('application_code')
      .eq('client_ref', client_ref)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return json({ error: error.message }, { status: 500 })
    }

    return json({ application_code: data?.application_code ?? null })
  } catch (e) {
    return json({ error: String(e) }, { status: 500 })
  }
})
