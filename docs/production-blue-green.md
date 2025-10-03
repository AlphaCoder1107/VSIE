# VIC Web Platform — Zero-Downtime (Blue–Green) Production Blueprint

This document turns the Make_it_Robust.md vision into concrete, step‑by‑step infrastructure and CI/CD that you can pitch and execute. It keeps today’s Supabase + static Next.js foundation, adds high‑availability (HA), and enables instant, risk‑free rollbacks.

## Goals
- 0‑downtime deploys for web + functions
- Fast rollback (< 1 min)
- Database durability (RPO ~0, RTO < 5 min)
- Observability (errors, logs, uptime), runbooks

## Architecture Overview
- CDN + router: Cloudflare (or Fastly) in front of everything
- Static web: Two environments A/B (Vercel or Netlify) or two GitHub Pages branches (prod-a, prod-b)
- Edge functions: Two Supabase projects (or two function prefixes) acting as A/B
- Database: Supabase (Paid) with HA + PITR + scheduled logical backups
- Storage: Supabase Storage, replicated
- Payments: Razorpay (unchanged)

```
Users → Cloudflare (KV switch ACTIVE_ENV)
       → Web A (blue) or Web B (green)
       → Functions A or Functions B
       → Supabase DB (HA, PITR)
```

## Environments
- Web A/B: Build the same repo twice: origin/main → web-a, origin/main → web-b
- Functions A/B options:
  1) Two Supabase projects (prod-a, prod-b) — simplest isolation
  2) One project with function prefixes (v1, v2) + secrets sets — advanced
- Secrets: store per‑env (A/B) sets in GitHub Environments or Cloudflare KV

## CI/CD
- Build job creates artifact once, deploys to A and B targets
- Smoke tests call /diag-health Edge Function
- If GREEN passes, flip ACTIVE_ENV in Cloudflare KV to new target
- Rollback = set ACTIVE_ENV back

## Health/Diagnostics
- diag-health function returns { ok, projectRef, commitSha, version, timestamp }
- Uptime checks: Cloudflare Health Checks, Statuspage
- Application errors: Sentry (frontend) + Supabase function logs streaming to a log sink

## Database HA & Backups
- Supabase paid plan with HA and PITR (7–30 days)
- Nightly logical dumps to object storage (Cloudflare R2/S3)
- Runbook to restore PITR and re-point functions

## Blue–Green Switch
- Cloudflare Worker fetch handler reads ACTIVE_ENV from KV and proxies to web-a or web-b origins
- For functions, publish two routes: /functions-a/* and /functions-b/*; Worker rewrites based on ACTIVE_ENV

## Runbook (Deploy)
1. CI builds commit SHA X
2. Deploy to Web-B and Functions-B
3. Hit /diag-health on B — must return ok:true and version X
4. Switch Cloudflare KV ACTIVE_ENV = B
5. Monitor 5–10 minutes; keep Web-A as hot standby for instant rollback

## Runbook (Rollback)
1. Set ACTIVE_ENV back to A
2. Investigate errors via Sentry/logs

## Security & RBAC
- Keep ADMIN_EMAILS + EVENT_MANAGER_EMAILS secrets in both A/B
- Enforce reCAPTCHA for public endpoints where abuse is possible
- Use Service Role only inside Edge Functions

## Cost Rough‑order
- Cloudflare (free to low tier), Vercel/Netlify (pro), Supabase Pro, Sentry (team)
- Optional R2/S3 for backups

## Next Steps
- Add diag-health function
- Add workflow blue-green.yml
- Configure Cloudflare Worker + KV namespace
- Create second Supabase project (prod‑b) or function prefixes
