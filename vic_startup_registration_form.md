# VIC — Startup & Founder Registration Form

**Purpose:**
This document specifies a professional, theme-matching registration form for *VIC — Vidya Innovation Centre* to let college students, founders, and early-stage startups apply for incubation. It contains UX design, field-level requirements, accessibility, validation rules, attachments, backend API contract, admin flows, email templates, payment guidelines, privacy & legal notes, and implementation recommendations.

---

## 1. Goals & Objectives

- Provide a fast, accessible, and secure application form consistent with the VIC website theme.
- Collect structured information to evaluate startups quickly.
- Accept required supporting documents (Idea file, Research document, College ID, Aadhaar copy) with secure handling and consent.
- Accept a small registration fee (₹100–₹500) when required.
- Offer Draft & Resume capabilities so applicants can return and finish later.
- Deliver clear admin workflows (review, accept, reject) with export & notifications.

---

## 2. Who can apply

- Individual students of Vidya College of Engineering (UG/PG).
- Faculty-associated teams.
- Founders from other colleges seeking collaboration/mentorship under VIC (subject to validation).

---

## 3. Overall UX & Theme Guidance

- Follow the existing VIC site visuals (use existing colors, fonts, and logo). If the site uses Tailwind, reuse the design tokens. Suggested layout:
  - **Hero**: small header "Apply for VIC Incubation" + short 2-line subtitle.
  - **Multi-step card** (3 steps): 1) Startup & Idea; 2) Founder & College details; 3) Attachments, Payment & Declaration.
  - Keep forms compact: two-column layout on desktop, stacked single column on mobile.
  - Use a sticky progress indicator at top (Step 1 / 3) and a floating save draft button.
  - Use friendly microcopy beneath inputs for guidance (max 150 words for pitch, acceptable file types, max file size).

### Visual examples (Tailwind classes used in examples):
- Container: `max-w-3xl mx-auto p-6`.
- Card: `bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6`.
- Input: `w-full border rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-offset-1`.
- Primary button: `inline-flex items-center px-5 py-2 rounded-2xl font-semibold shadow-sm`.

---

## 4. Form Flow & UX details

**Recommended flow (multi-step):**

1. **Step 1 — Startup / Idea**
   - Startup name
   - One-line elevator pitch (max 140 chars)
   - Problem statement (short)
   - Proposed solution (short)
   - Stage (Idea / Prototype / MVP / Revenue)
   - Industry vertical (dropdown)
   - Target customers
   - Amount of help required (Mentorship / Funding / Office Space / Legal / Technical)

2. **Step 2 — Founder(s) & College**
   - Primary founder name (first/last)
   - Role (Founder / Co-founder / Student)
   - Email (college preferred)
   - Phone number (with country code)
   - College name, Branch, Year / Graduation year
   - Team size and GitHub / LinkedIn / Website (optional)
   - Secondary founder(s) — allow adding dynamic list (Name, Email, Role)

3. **Step 3 — Attachments, Fee & Declaration**
   - Upload Idea file (pdf/docx) — **required**
   - Upload Research Document (pdf/docx) — **required**
   - Upload College ID card (image/pdf) — **required**
   - Upload Aadhaar copy (image/pdf) — **required** — see privacy notes below
   - Registration fee payment (Razorpay/PayU) — optional depending on policy
   - Consent checkboxes: Terms & Conditions, Privacy Policy, Consent for storing documents
   - Submit button

**UX details:**
- Use inline validation and clear red messages for errors.
- Show preview thumbnails for uploaded files and allow deletion/reupload.
- Allow user to save progress (Save Draft) and return using email link or OTP verification.
- After successful submit, show a confirmation page with application ID and next steps + estimated review time.

---

## 5. Fields & Validation (detailed)

> Fields flagged **(required)** must be completed. Show help text below inputs where needed.

### Startup / Idea

| Field | Type | Required | Validation / Notes |
|---|---:|:---:|---|
| Startup name | text | Yes | 3–80 chars, unique check (async) |
| Elevator pitch | text | Yes | max 140 chars, show character counter |
| Problem statement | textarea | Yes | 30–400 chars |
| Proposed solution | textarea | Yes | 30–600 chars |
| Stage | select | Yes | options: Idea, Prototype, MVP, Revenue |
| Industry | select (tags) | Yes | allow multi-select; suggest common industries |
| Target customer | text | Yes | small free-text |
| Support needed | checkbox group | No | Mentorship, Funding, Office space, Legal, Tech |

### Founder(s) & College

| Field | Type | Required | Validation / Notes |
|---|---:|:---:|---|
| Full name | text | Yes | name pattern validation |
| Role | select | Yes | Founder / Co-founder / Student / Mentor |
| Email | email | Yes | verify via OTP or confirmation link |
| Phone | tel | Yes | validate country code, 10 digits for India |
| College | text | Yes | pre-fill if user logged in / campus list dropdown |
| Branch | text/select | Yes | e.g., CSE, ECE |
| Year | select | Yes | First, Second, Third, Final, Alumni |
| GitHub / LinkedIn | url | No | optional; validate URL format |
| Add team members | dynamic list | No | allow adding up to 5 team members |

### Attachments

| Attachment | Allowed types | Required | Max size |
|---|---:|:---:|---:|
| Idea file | pdf, docx | **Yes** | 10 MB |
| Research doc | pdf, docx | **Yes** | 15 MB |
| College ID | image (jpg, png), pdf | **Yes** | 5 MB |
| Aadhaar copy | image (jpg, png), pdf | **Yes** | 5 MB |

**Attachment UX:** show file name, size, and a thumbnail preview for images; provide sample upload examples. Warn if file exceeds limit. Run server-side virus scan and PDF sanitization.

### Payment

| Field | Type | Required | Notes |
|---|---:|---:|---|
| Registration fee | number / payment gateway | Maybe | Default policy: ₹100–₹500 — pick the value on site settings |

**Payment UX:** Integrate Razorpay Checkout (India), display fee breakdown, and show successful payment receipt + transaction ID on confirmation.

---

## 6. Accessibility & Mobile-first Practices

- All labels must be associated with inputs (`<label for="id">`).
- Provide `aria-invalid`, `aria-describedby` for errors and help text.
- Ensure color contrast meets WCAG AA standards.
- Inputs must be reachable via keyboard (Tab order consistent).
- Use large, tappable controls on mobile (min 44x44 px touch targets).
- Avoid animations that cause motion sickness; provide a reduced-motion preference.

---

## 7. Security & Privacy Notes (critical)

- **Aadhaar/sensitive data**: Aadhaar is sensitive personal data. Only collect what is strictly necessary. Prefer asking applicants to upload redacted copies or cover the Aadhaar number except last 4 digits. If collecting full Aadhaar, you must:
  - Provide explicit consent checkbox describing why it is needed.
  - Store it encrypted at rest (AES-256) and limit access to authorized staff only.
  - Define data retention period (e.g., delete non-selected applicant documents after 1 year) and document this in the privacy policy.
- Use server-side validation and sanitize all inputs to prevent injection.
- Use HTTPS and HSTS on GitHub Pages via custom domain.
- Virus-scan file uploads, and limit allowed file types and sizes.
- Implement rate-limiting, CSRF protection and reCAPTCHA to avoid bot abuse.

---

## 8. Backend / API Contract

**POST `/api/incubation/apply`** — submit application

Request JSON (multipart/form-data for file uploads):

```json
{
  "startup_name":"",
  "pitch":"",
  "problem":"",
  "solution":"",
  "stage":"Idea",
  "industry":["AgriTech"],
  "target_customer":"",
  "support_needed":["Mentorship"],
  "founders":[
    {"name":"","email":"","phone":"","role":"Founder","college":"Vidya College of Eng","branch":"CSE","year":"3rd"}
  ],
  "attachments":{
    "idea_file":"(file)",
    "research_doc":"(file)",
    "college_id":"(file)",
    "aadhaar":"(file)"
  },
  "fee_paid":{
    "gateway":"razorpay",
    "transaction_id":"RZP123...",
    "amount":200
  },
  "consent":true
}
```

Response:

```json
{ "status":"ok","applicationId":"VIC2025-000123","nextSteps":"..." }
```

**Admin endpoints** (examples):
- `GET /api/admin/applications?status=pending&page=1&limit=20`
- `POST /api/admin/applications/{id}/status` with body `{status: 'accepted', remarks: '...'}`
- `GET /api/admin/applications/{id}/download` (zip attachments)

**Storage recommendations:**
- Use object storage (S3 or S3-compatible) for attachments, with server-side encryption and short-lived signed URLs for downloads.
- Store metadata in a relational DB (Postgres) with foreign keys to attachments table.

**Database high level schema:**
- `applications` (id, startup_name, pitch, stage, industry jsonb, status, created_at, updated_at, fee_amount, fee_txn_id)
- `founders` (id, application_id, name, email, phone, role, college, branch, year)
- `attachments` (id, application_id, type, storage_path, size, uploaded_by, uploaded_at)

---

## 9. Admin Dashboard & Workflow

- Dashboard: list with filters (status, stage, college, applied date).
- Application detail view with attachments preview and actions: Accept / Request more info / Reject.
- Notes & internal comments area for reviewers.
- Bulk export (CSV/XLSX) and bulk email action.
- Webhook to Slack/Telegram when a new application arrives.

Status states: `draft`, `submitted`, `under_review`, `accepted`, `rejected`, `on_hold`.

---

## 10. Notifications & Email Templates

**Email 1 — Application received**

Subject: `VIC — Application Received ({{applicationId}})`

Body snippet:
> Hi {{founder_name}},
>
> Thanks for applying to VIC. Your application (ID: {{applicationId}}) has been received. Review typically takes 7–14 days. We'll contact you at {{email}} with next steps.

**Email 2 — Application accepted**

Subject: `VIC — Application Accepted ({{applicationId}})`

Body snippet:
> Congratulations! Your startup, {{startup_name}}, has been accepted for incubation. Please visit the portal to view the onboarding steps.

**Email 3 — Request for more info**

Subject: `VIC — More information required ({{applicationId}})`

Body snippet:
> Please provide a short video demo / updated pitch deck / clarifications by replying to this email or uploading via your application link.

---

## 11. Payment Integration

- Suggested gateway for India: **Razorpay** (simple checkout & UPI/Netbanking/cards). Alternative: PayU or Stripe (if international).
- Implement webhooks to verify successful payment server-side before marking `fee_paid`.
- Show receipt and transaction ID on user dashboard.
- Keep registration fee configurable from site admin panel (min ₹0, max ₹500).

---

## 12. Terms & Conditions / Consent (Short sample)

**Short consent wording** (checkbox must be mandatory):
> I confirm that the information and documents provided are true and correct to the best of my knowledge. I agree to VIC storing these documents and contacting me for review. I have read and accept the VIC Terms & Privacy Policy.

Include specific statements about IP: "Submission of this application does not transfer ownership of intellectual property to VIC. Applicants are responsible for their IP protection." Provide a link to full T&C.

---

## 13. Analytics & Metrics to Track

- Number of applications per month, conversion rate (applied → accepted).
- Applications by stage and industry.
- Average review turnaround time.
- Drop-off points in multi-step form (use Google Analytics or Mixpanel events).

---

## 14. Legal & Compliance Checklist

- Display explicit data-retention policy and allow users to request deletion.
- Provide contact email for privacy inquiries.
- If collecting Aadhaar, follow institutional/legal guidelines. Consider advising applicants to share a masked copy.
- Maintain audit log of admin accesses to attachments.

---

## 15. Implementation Options (quick choices)

1. **Static site + 3rd party forms** (fast): Use Netlify Forms / Formspree + Zapier → Google Sheets. Pros: Minimal backend. Cons: Limitations on file handling & security for sensitive docs.
2. **Static + Payments**: Netlify Forms + Razorpay Checkout + serverless function to attach payment status. Works, but still careful about document storage.
3. **Full custom** (recommended): Host a small backend (Node/Express or Django/Flask) with S3 storage, Postgres DB, admin UI. Use OAuth/SAML if you want campus SSO later.

---

## 16. Sample HTML skeleton (multi-step, minimal)

```html
<!-- Example skeleton — use this as starting point. Implement styling with site theme/Tailwind -->
<form id="vic-form" enctype="multipart/form-data">
  <!-- Step 1: Startup -->
  <!-- Step 2: Founder(s) -->
  <!-- Step 3: Attachments & Payment -->
</form>
```

(Implement front-end validation, file previews, and a progress bar.)

---

## 17. Admin & Onboarding Checklist Once App Accepted

- Send acceptance email + onboarding schedule.
- Collect preferred date for orientation and workspace request.
- Assign a mentor and create an internal onboarding task.
- Add accepted startups to VIC portal and schedule intro call.

---

## 18. Next steps & Implementation Plan

1. Finalize the exact fields and required attachments (you already requested: Idea file, Research doc, College ID, Aadhaar copy; confirm retention policy).
2. Decide payment policy (charge or free). You've suggested ₹100–₹500 — make the value configurable.
3. Choose architecture: quick launch (Netlify + Zapier) or secure custom backend.
4. Build front-end UI on the VIC site and test across devices.
5. Test full flow (file uploads, virus scanning, payment, email notifications).
6. Launch with a soft rollout to campus and collect feedback.

---

## 19. Appendix — Example JSON for Admin CSV Export

```csv
applicationId,startup_name,founder_name,email,phone,college,stage,industry,status,applied_on,fee_paid,fee_txn_id
VIC2025-000123,CodePod,Ankit Sharma,ankit@example.com,+91-9XXXXXXXXX,Vidya College,Prototype,EdTech,submitted,2025-09-28,true,RZP-1234
```

---

## 20. Final notes & recommendations

- Because you're collecting sensitive identity documents, the **recommended path** is to run a secure custom backend and store attachments in encrypted object storage. If you need to launch faster and cannot provision a secure backend right now, *do not* collect Aadhaar on the public form — instead ask applicants to bring sensitive ID documents during an in-person verification step.

---

*If you want, I can now:*
- produce a UI mockup (Figma-style spec or React+Tailwind component) that matches your site's theme, **or**
- generate the HTML/JS (multi-step form) + serverless function examples (Netlify Functions / Vercel) to handle uploads & payment.


