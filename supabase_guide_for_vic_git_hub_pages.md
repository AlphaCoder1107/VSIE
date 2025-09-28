# Supabase Integration Guide — VIC (GitHub Pages static + Supabase storage & DB)

**Purpose:** This document explains, step-by-step, how to use Supabase as the backend for your VIC Startup Registration form while keeping the site on GitHub Pages. It covers project setup, database schema and SQL, Storage configuration, security and RLS policies, Edge Function examples (for secure operations), client-side code to upload files and insert application rows, admin access & signed-download flow, payment verification notes, and testing/checklist.

---

## Quick summary

- Host static front-end on GitHub Pages.
- Use Supabase for: Postgres DB (applications, founders, attachments), Storage (attachments bucket), Edge Functions (secure server-side operations like generating signed URLs or payment verification).
- Use `ANON` key only for allowed client-side actions (create application rows, upload to public buckets for prototypes). Use Edge Functions with `service_role` key for sensitive ops (private buckets, signed URLs, payment verification).

---

## 1. Supabase project setup (practical)

1. Create a Supabase project at https://supabase.com and note:
   - SUPABASE_URL (e.g. `https://xyz.supabase.co`)
   - SUPABASE_ANON_KEY (for client-side JS)
   - SUPABASE_SERVICE_ROLE_KEY (server-side — keep secret)
2. In the Supabase Console, go to **Storage → Create bucket**: create `attachments`.
   - For testing you can keep `public` = true; for production set `public` = false.
3. In **Database → SQL Editor**, run the SQL in section **6** to create tables and helper functions.
4. In **Auth → Settings**, enable Email login if you want users to authenticate. (Optional: you can accept anonymous submissions and capture email.)
5. In **Settings → API**, copy the `anon` key and `url` for use in client JS. NEVER put the `service_role` key into client-side code.
6. (Recommended) Create a `supabase-admin` service role environment under Supabase Edge Functions or your own server to hold the `service_role` key.

---

## 2. Storage configuration (attachments bucket)

- Bucket name: `attachments`.
- For **sensitive documents** (College ID, Aadhaar): set `public=false`. Use Edge Functions to write files to this bucket and generate short-lived signed URLs (download) for admin.
- Allowed file types: `.pdf, .docx, .doc, .jpg, .jpeg, .png`.
- Max file sizes: recommend 15 MB for research doc, 10 MB for idea file, 5 MB for ID/Aadhaar. Enforce client and server-side checks.
- CORS: Storage uses Supabase SDK for signed uploads — CORS not required for direct SDK usage. If you call via REST, configure CORS appropriately.
- File metadata: when uploading, set `cacheControl: '3600'` and add metadata fields like `application_id`, `uploader_email`, `type`.

---

## 3. Security model & best practices

- **Client-side (GitHub Pages)**: only use `SUPABASE_ANON_KEY`. Limit client actions to safe operations: create application rows without sensitive raw data, or upload to public bucket for non-sensitive assets.
- **Server-side / Edge Functions**: hold `SUPABASE_SERVICE_ROLE_KEY`. Use Edge Functions for:
  - Generating signed upload URLs for private uploads.
  - Generating signed download URLs for admin.
  - Verifying payment signatures (Razorpay) and mark `fee_paid` true.
  - Masking or encrypting sensitive fields if required.
- **Aadhaar & sensitive IDs**: Prefer redacted/masked copies (show only last 4 digits). If you must store full IDs, store them in a private bucket, restrict access, log admin access, and define a retention policy (e.g., delete after 1 year for non-selected apps).
- **Encryption**: Supabase storage is encrypted at rest by default. For extra privacy, you can encrypt files client-side before upload using a public-key cryptography scheme and decrypt on server with private key (advanced).
- **RLS (Row Level Security)**: apply RLS to protect application rows. Typical policy: allow insert from anon (if accepting open submissions) but restrict select to authenticated admin role or function.
- **Audit & Logging**: Keep an `admin_actions` table or use Edge Function logs for who downloaded what and when.

---

## 4. Recommended architecture patterns (2 options)

### Pattern A — Client-only (fast, prototype)
- Use `supabase-js` from the GitHub Pages page with `ANON_KEY`.
- Upload files to `attachments` (public) and insert application row in `applications` table.
- Admin uses Supabase Dashboard to view rows and download files.

**When to use:** fast prototype, not storing Aadhaar or sensitive data.

### Pattern B — Secure (recommended for production)
- Use Edge Functions (or serverless) with `SERVICE_ROLE_KEY`.
- Flow:
  1. Client submits metadata (no files) to an Edge Function (authenticated or unauthenticated). Edge Function creates an application row, returns application ID and pre-signed upload URLs or an upload token.
  2. Client uploads files directly to the private bucket using the signed upload URL or Edge-generated signed request.
  3. Client informs Edge Function upload is complete; Edge Function updates the DB row and returns next steps.
  4. Admin requests a signed download URL via Edge Function for private files.

**When to use:** production with sensitive documents & payments.

---

## 5. Admin privileges & RLS policy examples

### Goals
- Admins (only) can `SELECT` application rows and get signed download URLs for attachments.
- Any visitor (or authenticated user) can `INSERT` an application row (if you want public applications).

### Example RLS policy SQL snippets

```sql
-- enable RLS on applications
alter table public.applications enable row level security;

-- allow inserts from anon (only if you accept public anonymous submissions)
create policy "public_insert" on public.applications
  for insert using ( true );

-- allow select only for admin role (we'll check a custom claim)
create policy "admin_select" on public.applications
  for select using ( auth.role() = 'supabase_admin' );
```

Note: `auth.role()` is an example — Supabase Auth supports JWT claims. For tighter control, use Edge Functions to proxy admin reads.

---

## 6. Database schema & SQL (copy-paste)

Run the following in Supabase SQL Editor. It creates a clean schema with helper functions.

```sql
-- Applications schema
create table if not exists public.applications (
  id bigint generated by default as identity primary key,
  application_code text,
  startup_name text not null,
  pitch text,
  problem text,
  solution text,
  stage text,
  industry text[],
  target_customer text,
  support_needed text[],
  founders jsonb,
  attachments jsonb,
  fee_paid boolean default false,
  fee_txn_id text,
  status text default 'submitted',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- sequence & function to generate human-friendly app code
create sequence if not exists application_sequence start 1;

create or replace function public.generate_application_code()
returns text language sql as $$
  select 'VIC' || to_char(current_date,'YYYY') || '-' || lpad(nextval('application_sequence')::text,6,'0');
$$;

-- trigger to populate application_code
create or replace function public.set_application_code()
returns trigger as $$
begin
  new.application_code := public.generate_application_code();
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_set_app_code
before insert on public.applications
for each row execute function public.set_application_code();

-- Attachments table (optional)
create table if not exists public.attachments (
  id bigint generated by default as identity primary key,
  application_id bigint references public.applications(id) on delete cascade,
  type text,
  storage_path text,
  file_name text,
  size_kb int,
  uploaded_at timestamptz default now()
);

-- Indexes
create index if not exists idx_applications_status on public.applications(status);
create index if not exists idx_applications_created on public.applications(created_at desc);
```

---

## 7. Supabase Edge Function examples

### 7.1: Generate signed download URL (admin-only)
- Purpose: Admin requests a signed URL for a private file. Edge function checks admin token and returns signed URL from Storage API.

**Node (edge) example** (conceptual):
```js
import { serve } from 'std/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

serve(async (req) => {
  const { filePath } = await req.json()
  // verify admin — check Authorization header (JWT) or api-key
  // generate signed url
  const { data } = await supabase.storage.from('attachments').createSignedUrl(filePath, 60) // 60s
  return new Response(JSON.stringify({ url: data.signedUrl }), { status: 200 })
})
```

### 7.2: Create application + return signed upload URLs (secure flow)
- Edge Function creates DB row and returns signed upload URLs so client can upload to private bucket without exposing service role key.

Conceptual flow:
1. Client POSTs `{ startup_name, pitch, founders, fileNames: { idea_file:'xxx.pdf', ... } }` to Edge function.
2. Edge function inserts application row, reads `id`, and calls `createSignedUrl` with method `PUT` (or `createSignedUploadUrl` equivalent) for each file name.
3. Edge function returns `{ applicationId, signedUploadUrls: { idea_file: url1, ... } }`.

This allows file upload directly to storage without making the bucket public.

---

## 8. Client-side implementation (detailed)

**Notes:** The client can use one of two flows: (A) direct client upload (anon key) into public bucket (fast), or (B) secure signed-upload flow via Edge Function (recommended). Below are both code snippets.

### 8.1 Client-only (public bucket) — basic form submission

```html
<!-- include in your GitHub Pages page -->
<script type="module">
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
const SUPABASE_URL = 'https://YOUR.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const form = document.getElementById('vic-form')
form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const fd = new FormData(form)
  // basic validation omitted

  const filesToUpload = ['idea_file','research_doc','college_id','aadhaar']
  const uploaded = {}
  for (const key of filesToUpload){
    const file = fd.get(key)
    if (!file) continue
    const path = `applications/${Date.now()}_${Math.random().toString(36).slice(2,8)}_${file.name}`
    const { data, error } = await supabase.storage.from('attachments').upload(path, file, { upsert: false })
    if (error) { console.error(error); alert('Upload failed'); return }
    uploaded[key] = data.path
  }

  const payload = {
    startup_name: fd.get('startup_name'),
    pitch: fd.get('pitch'),
    founders: JSON.stringify([{ name: fd.get('founder_name'), email: fd.get('founder_email') }]),
    attachments: uploaded
  }

  const { data, error } = await supabase.from('applications').insert([payload]).select().single()
  if (error) { console.error(error); alert('Submit failed'); return }
  alert('Submitted — ' + data.application_code)
  form.reset()
})
</script>
```

### 8.2 Secure flow (Edge Function + signed uploads)

**Client:** send metadata to Edge Function `/api/create-application`.

**Edge Function:** insert DB row, call `createSignedUploadUrl` for each expected file name, return signed URLs.

**Client:** upload files to returned signed URLs using `fetch( url, { method: 'PUT', body: file } )`.

**Client:** call Edge Function `/api/complete-uploads` to tell server uploads are done; Edge Function will move files into final storage path (if needed) and update the DB row.

This flow keeps your private bucket secret and is the recommended production approach.

---

## 9. Admin UI, viewing & download

- Option A (quick): Use Supabase Console → Table Editor to view rows and Storage to browse files. For private buckets, use Edge Function to generate signed URLs for each file when you click "Download".
- Option B (recommended): Build a small admin React page (hosted on Vercel/Netlify) that calls Edge Functions to list applications and to get signed download URLs. Protect this admin page with Supabase Auth (admin login) or simple HTTP auth.
- Audit: log each signed URL creation into `admin_actions` table with `admin_id`, `application_id`, `action`, `timestamp`.

---

## 10. Payment integration (Razorpay) with Supabase

- Create an order on your server (Edge Function) using Razorpay secret keys. Return `order_id` to client.
- Client opens Razorpay Checkout and completes payment.
- Razorpay calls your webhook (Edge Function) to verify signature & payment status. On verified payment, Edge Function updates `applications.fee_paid = true` and stores `fee_txn_id`.
- Do not rely solely on client-side confirmation; always verify via server webhook.

---

## 11. Testing & rollout checklist

- [ ] Create Supabase project and run SQL.
- [ ] Create `attachments` bucket with proper `public` flag.
- [ ] Implement client form with either direct upload or signed-upload flow.
- [ ] Test uploads of small and large files and verify DB rows are created.
- [ ] Test admin signed download flow.
- [ ] Test Razorpay payment flow & webhook verification.
- [ ] Implement retention policy and data deletion test.
- [ ] Add reCAPTCHA to front-end if public to avoid spam.

---

## 12. Troubleshooting FAQ

**Q: Upload fails with CORS or 403** — If uploading directly from client to storage, ensure bucket is public for test flows. For private buckets, you must use signed URLs.

**Q: Files visible publicly even though bucket set private** — Verify you're not returning public paths. Use `createSignedUrl` or server-proxied downloads.

**Q: Need to rotate service_role key** — Rotate in Supabase settings and update Edge Functions or server envs immediately.

---

## 13. Appendix — Useful SQL & helper queries

Get latest 50 applications:
```sql
select id, application_code, startup_name, founder_email, status, created_at
from public.applications
order by created_at desc
limit 50;
```

Export applications to CSV using Supabase UI or with a SQL client.

---

## 14. Next steps I can do for you

- Generate the exact `vic-form` HTML + JavaScript (client-only) with placeholders for `SUPABASE_URL` and `SUPABASE_ANON_KEY` ready to paste into your GitHub Pages page.
- Generate Edge Function code (create-application, signed-upload, generate-download-url, razorpay-webhook) for Supabase Edge Functions.
- Produce a minimal admin React page (hosted on Vercel) to list applications and download attachments using signed URLs.

Tell me which of the next steps you want and I will produce the code (client script, Edge Functions, or admin UI) ready to paste and deploy.

---

*End of Supabase Integration Guide for VIC.*