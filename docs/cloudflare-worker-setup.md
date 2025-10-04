# Cloudflare Worker Router Setup

1) Create a new Worker
- Add a KV namespace named `ENV_KV`
- Bind KV to the Worker as `ENV_KV`

2) Set environment variables
- WEB_A_BASE = https://<your-vercel-app>.vercel.app
- WEB_B_BASE = https://alphacoder1107.github.io
- WEB_B_PATH = /VSIE

3) Publish router
- Deploy `cloudflare/worker-router.js`

4) Routing
- Set your apex or subdomain DNS (e.g., app.vic.college) to Worker

5) Switch environments
- Set KV ACTIVE_ENV to `A` for Vercel (primary)
- Set KV ACTIVE_ENV to `B` for GitHub Pages (secondary)

6) Health check
- GET https://<your-worker-domain>/health → { ok: true, active: "A" | "B" }
