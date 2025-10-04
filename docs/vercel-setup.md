# Vercel Setup (Primary A)

1) Create a new Vercel project
- Import the GitHub repo AlphaCoder1107/VSIE
- Framework: Next.js
- Build command: `npm run build`
- Output directory: `out`
- Disable Image Optimization (already unoptimized)

2) Environment variables
- NEXT_PUBLIC_BASE_PATH = "" (empty for Vercel root)
- NEXT_PUBLIC_SUPABASE_URL = https://gypnevkgwayqhgaqlviz.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon key>
- NEXT_PUBLIC_SUPABASE_BUCKET = attachments
- NEXT_PUBLIC_RECAPTCHA_SITE_KEY = <optional>

3) Domains
- Set your primary domain (e.g., vic.college) to Vercel
- Keep GitHub Pages as secondary (B) at https://alphacoder1107.github.io/VSIE/

4) Deploy
- Push to main; Vercel will build and host A
	- On GitHub Pages, keep NEXT_PUBLIC_BASE_PATH set to /VSIE (handled by your Pages workflow or manual build). On Vercel, keep it empty.

5) Cloudflare Worker vars
- WEB_A_BASE = https://<your-vercel-app>.vercel.app
- WEB_B_BASE = https://alphacoder1107.github.io
- WEB_B_PATH = /VSIE
- KV ENV_KV: set ACTIVE_ENV = A (primary on Vercel)

6) Flip traffic (Blue→Green or Green→Blue)
- Change ACTIVE_ENV in KV: A = Vercel, B = GitHub Pages
- Optional: add a DNS CNAME (www) to Cloudflare Worker for vanity domain

7) Optional: vercel.json
If you want to be explicit, you can add a minimal vercel.json in the repo root to lock the output directory:

{
	"buildCommand": "npm run build",
	"outputDirectory": "out"
}

