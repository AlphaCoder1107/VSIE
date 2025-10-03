// Cloudflare Worker router for Blue–Green switch
// KV binding: ENV_KV (with key ACTIVE_ENV = 'A' | 'B')
// Routes:
//  - Web A origin: https://alphacoder1107.github.io/VSIE/
//  - Web B origin: https://b.alphacoder1107.pages.dev/VSIE/ (example)
//  - Functions A/B origins: supply full base URLs

export default {
  async fetch(request, env) {
    const active = (await env.ENV_KV.get('ACTIVE_ENV')) || 'A'
    const url = new URL(request.url)

    // Map to origins
    const origins = {
      A: 'https://alphacoder1107.github.io/VSIE',
      B: 'https://b.alphacoder1107.pages.dev/VSIE'
    }
    const targetBase = origins[active] || origins.A
    const targetUrl = new URL(targetBase + url.pathname + url.search)

    const res = await fetch(new Request(targetUrl.toString(), request))
    return res
  }
}
