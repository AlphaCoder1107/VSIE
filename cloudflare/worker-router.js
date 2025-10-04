// Cloudflare Worker router for Blue–Green switch
// KV binding: ENV_KV with key ACTIVE_ENV = 'A' | 'B'
// Env bindings (set in Worker settings):
//  - WEB_A_BASE: https://your-vercel-app.vercel.app  (primary A)
//  - WEB_B_BASE: https://alphacoder1107.github.io    (secondary B root)
//  - WEB_B_PATH: /VSIE                              (path prefix on GH Pages)

export default {
  async fetch(request, env) {
    // Health endpoint for quick checks
    const url = new URL(request.url)
    if (url.pathname === '/health') {
      const active = (await env.ENV_KV.get('ACTIVE_ENV')) || 'A'
      return new Response(JSON.stringify({ ok: true, active }), {
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
      })
    }

    const active = (await env.ENV_KV.get('ACTIVE_ENV')) || 'A'
    const path = url.pathname + url.search

    const webABase = (env.WEB_A_BASE || '').replace(/\/$/, '')
    const webBBase = (env.WEB_B_BASE || '').replace(/\/$/, '')
    const webBPath = (env.WEB_B_PATH || '').replace(/\/$/, '')

    // Build target URL depending on active env
    const targetPrimary = active === 'B' ? `${webBBase}${webBPath}${path}` : `${webABase}${path}`
    const targetSecondary = active === 'B' ? `${webABase}${path}` : `${webBBase}${webBPath}${path}`

    // Clone the incoming request for target origin; strip Host to let fetch set it
    const headers = new Headers(request.headers)
    headers.delete('host')

    const primaryReq = new Request(targetPrimary, {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'follow'
    })

    try {
      const res = await fetch(primaryReq)
      // Fallback for GET only if primary has a hard failure (>=500)
      if (request.method === 'GET' && res.status >= 500) {
        const secondaryReq = new Request(targetSecondary, {
          method: request.method,
          headers,
          redirect: 'follow'
        })
        const res2 = await fetch(secondaryReq)
        return res2
      }
      return res
    } catch (e) {
      if (request.method === 'GET') {
        const secondaryReq = new Request(targetSecondary, {
          method: request.method,
          headers,
          redirect: 'follow'
        })
        return fetch(secondaryReq)
      }
      return new Response('Upstream error', { status: 502 })
    }
  }
}
