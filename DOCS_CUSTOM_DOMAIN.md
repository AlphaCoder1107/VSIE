# Custom domain setup (vic.college)

This project is deployed to GitHub Pages. To use your apex domain vic.college:

1) CNAME file
- The repo includes `public/CNAME` with content `vic.college`.
- The CI reads this and builds the site without a basePath (root URLs).

2) GitHub Pages settings
- Repo → Settings → Pages
- Source: GitHub Actions (already configured)
- Custom domain: `vic.college` (enter it here as well). Save and enforce HTTPS.

3) DNS on GoDaddy
- Create four A records pointing to GitHub Pages:
  - A @ → 185.199.108.153
  - A @ → 185.199.109.153
  - A @ → 185.199.110.153
  - A @ → 185.199.111.153
- Create a CNAME for www (optional):
  - CNAME www → <your-username>.github.io
  - In GitHub Pages custom domain, also add `www.vic.college` if you want www.

Propagation can take up to a few hours.

4) Next.js basePath
- No changes needed locally. The workflow sets `NEXT_PUBLIC_BASE_PATH` empty when CNAME exists.

5) Supabase
- No action for domain change. Ensure env in GitHub repository:
  - Settings → Variables → `NEXT_PUBLIC_SUPABASE_URL`
  - Settings → Secrets → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Edge Functions are already deployed using the project ref.

6) Google reCAPTCHA v3
- Create a new site at https://www.google.com/recaptcha/admin
  - Domains: `vic.college` and optionally `www.vic.college`
  - Type: reCAPTCHA v3
- Add the site key in repo variables:
  - `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
- Add the secret key for verification function:
  - `RECAPTCHA_SECRET` in repo Secrets.
- The `verify-recaptcha` function will use `RECAPTCHA_SECRET` from Supabase project or GitHub Actions env depending on how you've deployed functions. Prefer setting it in Supabase project settings as an env var for the function.

7) Supabase CORS
- Supabase edge functions generally allow any origin (we set CORS headers).
- If you’ve configured Storage CORS, add `https://vic.college` (and www) to allowed origins; public buckets don’t need CORS for GET.

8) GitHub Actions
- Push to main triggers build and deploy. The workflow detects `public/CNAME` and builds for root domain.

Troubleshooting
- If the site 404s on subpaths shortly after switching, Pages cache might need time. Try clearing browser cache or wait for propagation.
- Ensure Pages → Custom domain shows a green check for DNS.
