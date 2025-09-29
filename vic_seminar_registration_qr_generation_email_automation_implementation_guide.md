# VIC Seminar Registration — QR Generation & Email Automation

_A detailed implementation guide_: generate QR images for paid seminar registrations stored in Supabase, upload QR images to Supabase Storage, send confirmation emails (with QR inline + attachment) to students automatically, and mark rows as processed.

This guide contains architecture, schema changes, full code examples (Node.js), deployment patterns, testing, verification flows, security considerations and operational recommendations.

---

## Table of contents
1. Overview & Goals
2. High-level architecture
3. Database schema & SQL
4. Environment variables & secrets
5. Option patterns (Inline vs Worker)
6. Node.js implementation (processor)
   - `process-registration.js` (single-run / callable)
   - `batch-worker.js` (cron)
7. Integrating into existing payment flow (call after insert)
8. Supabase Storage: bucket setup & public vs signed URL
9. Email templates & SendGrid tips
10. Verification endpoint (gate check-in)
11. Retries, error handling & observability
12. Security & best practices
13. Production rollout checklist
14. Appendix: Deno Edge Function sketch and SQL trigger idea

---

## 1. Overview & Goals
When a student completes a successful Razorpay payment and the registration row is inserted in `seminar_registrations`, we want to:

- Generate a registration code (if not already present).
- Create a compact QR (either a verification URL or compact JSON payload).
- Save the QR as a PNG in Supabase Storage.
- Send the student an email with event information and the QR (inline & attachment).
- Update the `seminar_registrations` row with the QR URL and mark it as generated.

This guide assumes you already have working payment verification + DB insert logic.

---

## 2. High-level architecture

1. Existing payment verification endpoint verifies Razorpay and inserts into `seminar_registrations`.
2. Immediately after insert: call `processRegistrationById(id)` (simplest, immediate flow).
   - OR: Write DB row only and let a background worker poll for unprocessed paid rows.
3. Processor reads row → prepares QR payload → generates PNG → uploads to Supabase Storage → sends email → updates row.
4. Verification endpoint can decode QR payload (or look up code) at the gate and mark `checked_in=true`.

Diagram (text):
```
Frontend (Razorpay) -> Server (verify payment, insert row) -> Processor (generate qr + upload + email) -> Student email
                                                           -> Storage (qr.png)
Admin / Gate -> verify endpoint -> DB mark checked_in
```

---

## 3. Database schema & SQL

If you haven’t already, add helpful columns to `seminar_registrations`.

```sql
-- Add columns to track QR generation and store URL
alter table public.seminar_registrations
  add column qr_url text,
  add column qr_generated boolean default false,
  add column qr_generated_at timestamptz,
  add column checked_in boolean default false;

-- Optional: store email send failures for retry logic
alter table public.seminar_registrations
  add column email_failed_count int default 0;
```

If you want Postgres to generate `registration_code` automatically, you can use a trigger/sequence pattern (see Appendix). Otherwise generate in application code.

---

## 4. Environment variables & secrets

Make sure your runtime has the following env vars (server-side only):

- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — service_role key (NEVER expose to client)
- `STORAGE_BUCKET` — name of the Supabase bucket to store QR images (e.g., `registration-qrs`)
- `SENDGRID_API_KEY` — (or SMTP credentials) for sending email
- `EMAIL_FROM` — verified sender (eg. `no-reply@vic.example`)
- `VERIFY_BASE_URL` — base URL used inside QR payload for verification (eg `https://vic.example/verify`)
- (optional) `SENDGRID_TEMPLATE_ID` — if you use SendGrid templates

Permissions: Only store `SUPABASE_SERVICE_ROLE_KEY` in your server environment. If running a cron worker on a VPS or as an Edge Function, set these env vars in that service.

---

## 5. Option patterns (Inline vs Worker)

**Inline (recommended if traffic is light):**
- After you verify payment and insert the DB row, immediately call the processor function. Email delivered instantly.
- Pros: simple, instant feedback, easier to handle per-request errors.
- Cons: increases latency for the HTTP response to the frontend (can be made async by returning early and queuing the job instead).

**Worker / Poller (recommended for scaling or decoupling):**
- A scheduled worker polls for `qr_generated = false AND payment_status='paid'` and processes rows in batches.
- Pros: decoupled, controlled resource usage, retries possible.
- Cons: polling delay (1–5 minutes), more infra.

**Hybrid:** use immediate queueing (e.g., push the ID to a queue) and let an async worker consume.

---

## 6. Node.js implementation (processor)

### Dependencies

```bash
npm i @supabase/supabase-js qrcode @sendgrid/mail
```

### `process-registration.js` (callable function)

```js
// process-registration.js
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import sgMail from "@sendgrid/mail";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  STORAGE_BUCKET,
  SENDGRID_API_KEY,
  EMAIL_FROM,
  VERIFY_BASE_URL
} = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
sgMail.setApiKey(SENDGRID_API_KEY);

function buildQrPayload(row) {
  if (VERIFY_BASE_URL) {
    return `${VERIFY_BASE_URL}?code=${encodeURIComponent(row.registration_code)}&id=${row.id}`;
  }
  return JSON.stringify({ id: row.id, code: row.registration_code, name: row.student_name, email: row.student_email });
}

function sanitizeFileName(s) {
  return String(s || "").replace(/[^a-z0-9-_\.]/gi, "-");
}

export async function processRegistrationById(registrationId) {
  // 1) fetch row
  const { data: row, error: selectErr } = await supabase
    .from("seminar_registrations")
    .select("*")
    .eq("id", registrationId)
    .maybeSingle();

  if (selectErr) throw selectErr;
  if (!row) throw new Error(`Registration ${registrationId} not found`);
  if (row.qr_generated) return { ok: true, message: "already processed" };

  // 2) build payload & QR PNG
  const payload = buildQrPayload(row);
  const pngBuffer = await QRCode.toBuffer(payload, { type: "png", scale: 6 });

  // 3) upload to Storage
  const year = new Date().getFullYear();
  const code = row.registration_code || `reg-${row.id}`;
  const filePath = `registrations/${year}/${sanitizeFileName(code)}.png`;

  const { error: uploadErr } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, pngBuffer, {
    contentType: "image/png",
    upsert: true
  });
  if (uploadErr) throw uploadErr;

  const { publicURL } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);

  // 4) send email
  const msg = {
    to: row.student_email,
    from: EMAIL_FROM,
    subject: `Your VIC Ticket — ${row.registration_code}`,
    html: `
      <p>Hi ${row.student_name || "Participant"},</p>
      <p>Thanks for registering for <b>${row.event_slug}</b>.</p>
      <p>Your registration code: <b>${row.registration_code}</b></p>
      <p><img src="${publicURL}" alt="QR" style="max-width:320px"/></p>
    `,
    attachments: [
      {
        content: pngBuffer.toString("base64"),
        filename: `${sanitizeFileName(code)}.png`,
        type: "image/png",
        disposition: "attachment"
      }
    ]
  };

  try {
    if (SENDGRID_API_KEY) await sgMail.send(msg);
  } catch (e) {
    // optionally increment a retry counter and continue
    await supabase
      .from("seminar_registrations")
      .update({ email_failed_count: (row.email_failed_count || 0) + 1 })
      .eq("id", registrationId);
    throw e;
  }

  // 5) update DB to mark processed
  const { error: updateErr } = await supabase
    .from("seminar_registrations")
    .update({ qr_url: publicURL, qr_generated: true, qr_generated_at: new Date().toISOString() })
    .eq("id", registrationId);
  if (updateErr) throw updateErr;

  return { ok: true, registrationId, qr_url: publicURL };
}

// CLI helper
if (require.main === module) {
  const id = process.argv[2];
  if (!id) throw new Error("Usage: node process-registration.js <id>");
  processRegistrationById(parseInt(id, 10))
    .then(r => console.log("done", r))
    .catch(e => { console.error(e); process.exit(1); });
}
```

### `batch-worker.js` — cron poller

```js
// batch-worker.js
import { createClient } from "@supabase/supabase-js";
import { processRegistrationById } from "./process-registration.js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from("seminar_registrations")
    .select("id")
    .eq("qr_generated", false)
    .eq("payment_status", "paid")
    .limit(50);

  if (error) throw error;
  for (const r of data) {
    try {
      await processRegistrationById(r.id);
      console.log("processed", r.id);
    } catch (e) {
      console.error("failed", r.id, e.message || e);
    }
  }
}

run().catch(console.error);
```

Run via cron every 1–5 minutes: e.g., `*/2 * * * * cd /app && /usr/bin/node batch-worker.js` or use a serverless cron provider.

---

## 7. Integrating into existing payment flow

If you already verify Razorpay and insert the registration row, you have 2 quick choices:

- **Immediate call**: right after the `INSERT`, call `processRegistrationById(id)` to trigger QR/email immediately.
- **Return early + queue**: after `INSERT` return success to frontend and push the `id` to a job queue (e.g. Redis queue) that an async worker consumes.

Example (pseudo):

```js
// in your payment-verify endpoint (Node/Express)
const insert = await supabase.from('seminar_registrations').insert({...}).select('id').single();
const id = insert.data.id;
// option A: inline
await processRegistrationById(id);
// option B: queue
await redis.lpush('registration_queue', id);
res.json({ ok: true, id });
```

---

## 8. Supabase Storage: bucket setup & public vs signed URLs

1. Create a bucket: `Storage -> Create new bucket` (e.g. `registration-qrs`).
2. Decide access policy:
   - **Public**: `getPublicUrl(filePath)` returns a stable public link. Easier but visible to anyone who has the URL.
   - **Private + Signed**: keep bucket private and use `createSignedUrl(filePath, expirySeconds)` to create expiring links for emails. More secure.

Recommended: use private bucket + signed URL with an expiry (e.g., 30 days) to reduce link leak risk. Or store metadata in DB and generate signed URL when the user requests it.

Example: get signed URL

```js
const { data } = supabase.storage.from(STORAGE_BUCKET).createSignedUrl(filePath, 60 * 60 * 24 * 30); // 30d
const signedUrl = data.signedURL;
```

---

## 9. Email templates & SendGrid tips

- Use both HTML and plain-text fallback for deliverability.
- Avoid heavy attachments to reduce spam score; hosting the QR and embedding an `<img src="..."/>` is good. Attachments are fine as well.
- Verify your domain in SendGrid (SPF/DKIM) to improve Gmail deliverability.
- Provide clear subject & sender.
- Example minimal HTML (already used in code above). If using SendGrid templates, pass substitution data rather than raw HTML.

---

## 10. Verification endpoint (gate check-in)

Create a simple endpoint to validate a QR or code when scanned at the gate.

- If QR carries a verification URL (`/verify?code=...&id=...`) then scanning the QR opens that URL and your endpoint:
  - looks up the `registration_code` and `id`,
  - confirms `payment_status='paid' AND qr_generated=true`,
  - optionally marks `checked_in=true` and writes `checked_in_at`.

Example verify handler (Node/Express):

```js
app.get('/verify', async (req, res) => {
  const { id, code } = req.query;
  const { data: row } = await supabase.from('seminar_registrations').select('*').eq('id', id).maybeSingle();
  if (!row || row.registration_code !== code || row.payment_status !== 'paid') return res.status(404).send('Invalid');
  if (row.checked_in) return res.send('Already checked in');
  await supabase.from('seminar_registrations').update({ checked_in: true }).eq('id', id);
  res.send(`Welcome ${row.student_name}`);
});
```

For physical events, you may prefer a small admin web app that scans QR using device camera and calls this endpoint.

---

## 11. Retries, error handling & observability

- Wrap external calls (SendGrid, Storage) with retry/backoff.
- If email fails, record `email_failed_count` and retry later; do not mark `qr_generated` true unless email succeeded (or track separate flags for `qr_uploaded` and `email_sent`).
- Add logging to Nextcloud/Cloudwatch/Log service and set alerts for repeated failures.
- For batch worker: add exponential backoff and poison queue handling for rows that always fail.

---

## 12. Security & best practices

- NEVER store `SUPABASE_SERVICE_ROLE_KEY` in client-side code.
- Use HTTPS always for endpoints and hosted links.
- Prefer private storage + signed URLs for QR images.
- Rate-limit verification endpoints and add simple replay protection: once `checked_in=true`, deny re-entry or require staff override.
- Validate emails before send (optional) to reduce hard-bounces.

---

## 13. Production rollout checklist

1. Create bucket and DB columns in staging.
2. Deploy worker/processor to staging and set env vars.
3. Send test emails to a variety of inboxes (Gmail, Outlook) and check spam score.
4. Test QR scan -> verification flow on mobile.
5. Set up logging & monitoring (success/failure counts).
6. Move to production; verify domain for SendGrid.
7. Run a small pilot event and watch for issues.

---

## 14. Appendix

### A — Deno / Supabase Edge Function sketch

Supabase Edge Functions use Deno and native `fetch`/Web APIs. The logic mirrors `processRegistrationById`. Use `@supabase/supabase-js` for Deno or use direct REST calls to Supabase.

**Notes**: Edge functions have limited CPU time and runtime; uploading binary buffers and working with Base64 is supported but memory must be considered. For large volume, prefer worker infra.

### B — SQL trigger idea to create `registration_code`

This SQL creates a simple trigger that fills `registration_code` based on id + year. It's not perfectly gap-free (id MUST be known) but works for typical sequential inserts.

```sql
create function public.set_registration_code() returns trigger as $$
begin
  new.registration_code := format('VIC-SEM-%s-%s', to_char(now(), 'YYYY'), lpad((new.id)::text, 6, '0'));
  return new;
end;
$$ language plpgsql;

create trigger trg_set_registration_code
  before insert on public.seminar_registrations
  for each row
  execute function public.set_registration_code();
```

**Warning**: In a `before insert` trigger the `id` may not be assigned yet depending on column defaults; you can instead use a sequence or perform `after insert` update if needed.

---

## Closing notes
This document provides an end-to-end plan and copy-pasteable Node.js code to implement QR generation + email automation for your VIC seminar registrations. If you want, I can:

- Convert the Node.js processor into a ready-to-deploy Supabase Edge Function (Deno) file structure,
- Provide the SQL trigger that safely creates `registration_code` using a dedicated `serial` sequence,
- Add detailed SendGrid template JSON and substitution variables,
- Write the small admin verify UI (React/Tailwind) to scan and mark checked-in attendees.

Tell me which one you'd like next and I’ll produce it.

