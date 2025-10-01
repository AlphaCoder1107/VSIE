# VIC email setup: SendGrid + vic.college

Goal: Send transactional emails (tickets/QRs) from your domain, not Gmail, and avoid spam.

## 1) Pick sender addresses
- From: `no-reply@vic.college` (recommended for tickets)
- Reply-To: `support@vic.college` (or a mailbox you monitor)

Create these mailboxes/aliases in your provider (GoDaddy Email or Google Workspace). If you don’t want to host mailboxes yet, create a forwarder (support@ → your personal email).

## 2) Authenticate your domain in SendGrid
1. Login to SendGrid → Settings → Sender Authentication → Authenticate Your Domain
2. Select DNS host: GoDaddy (or Other)
3. Use automated security: On (CNAME records)
4. Enter your domain: `vic.college`
5. SendGrid will give you 3+ CNAME records:
   - `s1._domainkey.vic.college` → `s1.domainkey.<uXXXX>.wl.sendgrid.net`
   - `s2._domainkey.vic.college` → `s2.domainkey.<uXXXX>.wl.sendgrid.net`
   - Return-path (e.g. `em1234.vic.college`) → `<uXXXX>.sgdomain.com`
6. Add these CNAMEs in GoDaddy DNS, then click Verify in SendGrid.

This sets up DKIM and a custom return-path for better deliverability.

## 3) SPF and DMARC
- SPF: If you don’t use any other mail sender, add a TXT record:
  - Name: @
  - Value: `v=spf1 include:sendgrid.net ~all`
- If you also use Google Workspace (or another sender), combine includes:
  - `v=spf1 include:_spf.google.com include:sendgrid.net ~all`
- DMARC (optional but recommended):
  - Name: `_dmarc`
  - Value: `v=DMARC1; p=quarantine; rua=mailto:postmaster@vic.college; fo=1`
  - After monitoring for a few days, you can change `p=reject`.

## 4) Disable link/open tracking for transactional mail
We already disabled SendGrid click/open tracking in code to reduce spam flags. You don’t need to enable Link Branding unless you later enable click tracking.

## 5) Configure environment variables
Set these in Supabase → Project Settings → Configuration → Functions (Environment Variables):
- `SENDGRID_API_KEY` = your SendGrid API key
- `EMAIL_FROM` = `no-reply@vic.college`
- `EMAIL_FROM_NAME` = `VIC Tickets`
- `REPLY_TO` = `support@vic.college`
- `STORAGE_BUCKET` = `events` (used for QR images)
- `VERIFY_BASE_URL` = Optional link the QR should open, e.g. `https://vic.college/verify`

Save and redeploy functions `seminar-verify-payment` and `admin-resend-seminar-ticket`.

## 6) Update GitHub repository secrets (optional)
If you deploy functions via CI, also add these in Repo → Settings:
- Secrets: `SENDGRID_API_KEY`, `RECAPTCHA_SECRET`
- Variables: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` (already handled)

## 7) Test end-to-end
- Use Admin → Seminars → open a paid record → click “Resend ticket”.
- Or perform a ₹10 test payment (Razorpay test mode) to trigger the normal flow.
- Check headers in received email:
  - DKIM=pass, SPF=pass, DMARC=pass.
  - From shows `no-reply@vic.college`.

## 8) Tips to avoid spam
- Keep the From domain consistent (`@vic.college`).
- Use both text and HTML (we send both).
- Don’t include unnecessary links; we turned off click/open tracking.
- Maintain a valid Reply-To.
- If using Gmail inboxes, move first email to Primary and “Not spam” once—Gmail learns quickly.

That’s it—after DNS propagation (often < 1 hour on GoDaddy), emails should land in inbox reliably.
