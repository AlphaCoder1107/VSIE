import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Head from 'next/head'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

const DRAFT_KEY = 'vic-apply-draft'

const feeAmount = Number(process.env.NEXT_PUBLIC_REG_FEE || 0)
const formEndpoint = process.env.NEXT_PUBLIC_FORM_ENDPOINT || '' // e.g. https://your-api.example.com/api/incubation/apply
const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY || ''
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''

// Supabase (client-side) fallback configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SUPABASE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'attachments'
const supabaseEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
const supabase = supabaseEnabled ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

function classNames(...a) { return a.filter(Boolean).join(' ') }

const empty = {
  startup: {
    name: '', pitch: '', problem: '', solution: '', stage: 'Idea', industry: [], target: '', support: []
  },
  founder: {
    name: '', role: 'Founder', email: '', phone: '', college: '', branch: '', year: '', github: '', linkedin: '', website: '', team: []
  },
  attachments: {
    idea: null, research: null, collegeId: null, aadhaar: null
  },
  consent: false,
  payment: { paid: false, txnId: '', gateway: 'razorpay', amount: feeAmount }
}

const stages = ['Idea', 'Prototype', 'MVP', 'Revenue']
const roles = ['Founder', 'Co-founder', 'Student', 'Mentor']
const years = ['First', 'Second', 'Third', 'Final', 'Alumni']
const industries = ['AgriTech', 'EdTech', 'FinTech', 'HealthTech', 'AI/ML', 'SaaS', 'GreenTech', 'Other']
const supports = ['Mentorship', 'Funding', 'Office space', 'Legal', 'Tech']

function useDraft(state, setState) {
  // Load once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setState((s) => ({ ...s, ...parsed }))
      }
    } catch {}
  }, [setState])

  // Autosave
  useEffect(() => {
    try {
      const copy = { ...state, attachments: undefined } // don't store blobs in localStorage
      localStorage.setItem(DRAFT_KEY, JSON.stringify(copy))
    } catch {}
  }, [state])

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY) } catch {}
  }
  return { clearDraft }
}

export default function Apply() {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [state, setState] = useState(empty)
  const { clearDraft } = useDraft(state, setState)

  const canGoNext = useMemo(() => {
    if (step === 1) {
      const s = state.startup
      return s.name.length >= 3 && s.pitch.length > 0 && s.pitch.length <= 140 && s.problem.length >= 30 && s.solution.length >= 30 && stages.includes(s.stage) && s.industry.length > 0 && s.target.length > 0
    }
    if (step === 2) {
      const f = state.founder
      const phoneOk = /^\+?\d[\d\- ]{9,}$/.test(f.phone)
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)
      return f.name.length >= 2 && roles.includes(f.role) && emailOk && phoneOk && f.college && f.branch && f.year
    }
    if (step === 3) {
      const a = state.attachments
      const hasAll = a.idea && a.research && a.collegeId && a.aadhaar
      return !!hasAll && !!state.consent && (!feeAmount || state.payment.paid)
    }
    return false
  }, [state, step])

  const goNext = () => setStep((s) => Math.min(3, s + 1))
  const goPrev = () => setStep((s) => Math.max(1, s - 1))

  // Load Razorpay if key present
  useEffect(() => {
    if (!razorpayKey) return
    if (typeof window === 'undefined') return
    if (window.Razorpay) return
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
  }, [])

  // Load reCAPTCHA v3 script if site key present
  useEffect(() => {
    if (!recaptchaSiteKey) return
    if (typeof window === 'undefined') return
    if (document.getElementById('recaptcha-v3')) return
    const script = document.createElement('script')
    script.id = 'recaptcha-v3'
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(recaptchaSiteKey)}`
    script.async = true
    document.body.appendChild(script)
  }, [])

  const handlePay = async () => {
    if (!razorpayKey) return
    // Client-only demo; production should verify server-side
    const options = {
      key: razorpayKey,
      amount: Math.round((feeAmount || 0) * 100),
      currency: 'INR',
      name: 'VIC Registration',
      description: 'Startup registration fee',
      handler: function (response) {
        setState((s) => ({ ...s, payment: { ...s.payment, paid: true, txnId: response.razorpay_payment_id } }))
        setMessage('Payment successful. You can submit your application now.')
      },
      theme: { color: '#6c5cff' }
    }
    const rzp = new window.Razorpay(options)
    rzp.open()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')
    try {
      // 0) reCAPTCHA v3 verification (optional)
      if (recaptchaSiteKey && typeof window !== 'undefined' && window.grecaptcha) {
        await new Promise((resolve) => window.grecaptcha.ready(resolve))
        const token = await window.grecaptcha.execute(recaptchaSiteKey, { action: 'apply_submit' })
        try {
          if (supabaseEnabled && supabase) {
            const { data: verify, error: vErr } = await supabase.functions.invoke('verify-recaptcha', { body: { token } })
            if (vErr || !verify?.success) {
              throw new Error('reCAPTCHA verification failed')
            }
          }
        } catch (verr) {
          setMessage('Verification failed. Please retry the form submission.')
          return
        }
      }

      const { startup, founder, attachments, payment, consent } = state

      if (formEndpoint) {
        // Path 1: Submit to custom API endpoint (Express or similar)
        const fd = new FormData()
        fd.append('startup_name', startup.name)
        fd.append('pitch', startup.pitch)
        fd.append('problem', startup.problem)
        fd.append('solution', startup.solution)
        fd.append('stage', startup.stage)
        fd.append('industry', JSON.stringify(startup.industry))
        fd.append('target_customer', startup.target)
        fd.append('support_needed', JSON.stringify(startup.support))
        fd.append('founders', JSON.stringify([{ name: founder.name, email: founder.email, phone: founder.phone, role: founder.role, college: founder.college, branch: founder.branch, year: founder.year, github: founder.github, linkedin: founder.linkedin, website: founder.website, team: founder.team }]))
        if (attachments.idea) fd.append('idea_file', attachments.idea)
        if (attachments.research) fd.append('research_doc', attachments.research)
        if (attachments.collegeId) fd.append('college_id', attachments.collegeId)
        if (attachments.aadhaar) fd.append('aadhaar', attachments.aadhaar)
        fd.append('fee_paid', JSON.stringify({ gateway: payment.gateway, transaction_id: payment.txnId, amount: payment.amount }))
        fd.append('consent', String(!!consent))

        const res = await fetch(formEndpoint, { method: 'POST', body: fd })
        if (!res.ok) throw new Error(`Submission failed (${res.status})`)
        const data = await res.json().catch(() => ({}))
        setMessage(`Submitted successfully${data.applicationId ? ` (ID: ${data.applicationId})` : ''}. Check your email for confirmation.`)
        clearDraft()
        setState(empty)
        setStep(1)
        return
      }

      if (supabaseEnabled && supabase) {
        // Path 2: Supabase client-only (public bucket + public insert)
        // 1) Upload files to Storage bucket
  const uploaded = {}
  const clientRef = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `ref_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
        const filesToUpload = [
          ['idea', 'idea_file', attachments.idea],
          ['research', 'research_doc', attachments.research],
          ['collegeId', 'college_id', attachments.collegeId],
          ['aadhaar', 'aadhaar', attachments.aadhaar]
        ]
        for (const [key, field, file] of filesToUpload) {
          if (!file) continue
          const safeName = `${Date.now()}_${Math.random().toString(36).slice(2,8)}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
          const path = `applications/${safeName}`
          if (process.env.NODE_ENV !== 'production') {
            // Debug: show bucket and path used for upload (check in browser console)
            // This helps verify RLS policy matches (bucket_id + name prefix)
            // eslint-disable-next-line no-console
            console.log('[VIC upload]', { bucket: SUPABASE_BUCKET, path, type: file.type })
          }
          const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined })
          if (error) throw new Error(`Upload failed for ${field}: ${error.message}`)
          uploaded[field] = data.path
        }

        // 2) Insert application row
        const payload = {
          startup_name: startup.name,
          pitch: startup.pitch,
          problem: startup.problem,
          solution: startup.solution,
          stage: startup.stage,
          industry: startup.industry,
          target_customer: startup.target,
          support_needed: startup.support,
          founders: [{ name: founder.name, email: founder.email, phone: founder.phone, role: founder.role, college: founder.college, branch: founder.branch, year: founder.year, github: founder.github, linkedin: founder.linkedin, website: founder.website, team: founder.team }],
          attachments: uploaded,
          client_ref: clientRef,
          fee_paid: Boolean(payment?.paid),
          fee_txn_id: payment?.txnId || null
        }
        const { error } = await supabase.from('applications').insert([payload], { returning: 'minimal' })
        if (error) throw new Error(`DB insert failed: ${error.message}`)

        // Try to fetch application_code from Edge Function (service role)
        try {
          const { data: codeResp, error: codeErr } = await supabase.functions.invoke('get-application-code', {
            body: { client_ref: clientRef }
          })
          if (!codeErr && codeResp?.application_code) {
            setMessage(`Submitted successfully (ID: ${codeResp.application_code}). Check your email for confirmation.`)
          } else {
            setMessage('Submitted successfully. Check your email for confirmation.')
          }
        } catch {
          setMessage('Submitted successfully. Check your email for confirmation.')
        }
        clearDraft()
        setState(empty)
        setStep(1)
        return
      }

      // If neither path is configured
      setMessage('No submission backend configured. Set NEXT_PUBLIC_FORM_ENDPOINT or Supabase env vars (URL and ANON key).')
    } catch (err) {
      console.error(err)
      setMessage(`There was a problem submitting your application. ${err?.message ? '(' + err.message + ')' : ''} Please try again or contact VIC.`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Head>
        <title>Apply — VIC Startup Registration</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-vsie-900">
        <Navbar />
        <main id="main" className="py-24">
          <div className="container max-w-3xl">
            <div className="mb-6 text-center">
              <p className="text-vsie-accent font-medium">Apply for VIC Incubation</p>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight mt-2">Startup & Founder Registration</h1>
              <p className="mt-3 text-vsie-muted">Three quick steps. You can save a draft and finish later.</p>
            </div>

            {/* Progress */}
            <div className="mb-4 flex items-center justify-center gap-2 text-sm">
              {[1,2,3].map((i) => (
                <div key={i} className={classNames('px-3 py-1 rounded-full', i===step ? 'bg-vsie-accent text-white' : 'bg-white/5 text-white/70 border border-white/10')}>Step {i} / 3</div>
              ))}
              <button type="button" onClick={() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...state, attachments: undefined })) } catch {}; }} className="ml-auto text-xs px-3 py-1 rounded-full border border-white/10 text-white/80 hover:bg-white/10">Save draft</button>
            </div>

            <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              {step === 1 && (
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm mb-1">Startup name *</label>
                    <input className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2" value={state.startup.name} onChange={(e)=>setState(s=>({...s, startup:{...s.startup, name:e.target.value}}))} maxLength={80} required />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Elevator pitch (max 140 chars) *</label>
                    <input className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2" value={state.startup.pitch} onChange={(e)=>setState(s=>({...s, startup:{...s.startup, pitch:e.target.value}}))} maxLength={140} required />
                    <p className="text-xs text-vsie-muted mt-1">Be crisp and compelling.</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-1">Problem statement *</label>
                      <textarea className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2" rows={4} value={state.startup.problem} onChange={(e)=>setState(s=>({...s, startup:{...s.startup, problem:e.target.value}}))} required />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Proposed solution *</label>
                      <textarea className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2" rows={4} value={state.startup.solution} onChange={(e)=>setState(s=>({...s, startup:{...s.startup, solution:e.target.value}}))} required />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-1">Stage *</label>
                      <select className="w-full rounded-md bg-white text-black border border-white/10 px-3 py-2" value={state.startup.stage} onChange={(e)=>setState(s=>({...s, startup:{...s.startup, stage:e.target.value}}))}>
                        {stages.map(x=> <option className="text-black" key={x} value={x}>{x}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Industry *</label>
                      <select multiple className="w-full rounded-md bg-white text-black border border-white/10 px-3 py-2" value={state.startup.industry} onChange={(e)=>{
                        const vals = Array.from(e.target.selectedOptions).map(o=>o.value)
                        setState(s=>({...s, startup:{...s.startup, industry: vals}}))
                      }}>
                        {industries.map(x=> <option className="text-black" key={x} value={x}>{x}</option>)}
                      </select>
                      <p className="text-xs text-vsie-muted mt-1">Hold Ctrl/⌘ to select multiple.</p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-1">Target customers *</label>
                      <input className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2" value={state.startup.target} onChange={(e)=>setState(s=>({...s, startup:{...s.startup, target:e.target.value}}))} required />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Support needed</label>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {supports.map(x => (
                          <label key={x} className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={state.startup.support.includes(x)} onChange={(e)=>{
                              setState(s=>{
                                const curr = new Set(s.startup.support)
                                if (e.target.checked) curr.add(x); else curr.delete(x)
                                return {...s, startup:{...s.startup, support:[...curr]}}
                              })
                            }} />
                            <span>{x}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-1">Full name *</label>
                      <input className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2" value={state.founder.name} onChange={(e)=>setState(s=>({...s, founder:{...s.founder, name:e.target.value}}))} required />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Role *</label>
                      <select className="w-full rounded-md bg-white text-black border border-white/10 px-3 py-2" value={state.founder.role} onChange={(e)=>setState(s=>({...s, founder:{...s.founder, role:e.target.value}}))}>
                        {roles.map(x=> <option className="text-black" key={x} value={x}>{x}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-1">Email *</label>
                      <input type="email" className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2" value={state.founder.email} onChange={(e)=>setState(s=>({...s, founder:{...s.founder, email:e.target.value}}))} required />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Phone (+country code) *</label>
                      <input type="tel" className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2" value={state.founder.phone} onChange={(e)=>setState(s=>({...s, founder:{...s.founder, phone:e.target.value}}))} required />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm mb-1">College *</label>
                      <input className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2" value={state.founder.college} onChange={(e)=>setState(s=>({...s, founder:{...s.founder, college:e.target.value}}))} required />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Branch *</label>
                      <input className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2" value={state.founder.branch} onChange={(e)=>setState(s=>({...s, founder:{...s.founder, branch:e.target.value}}))} required />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Year *</label>
                      <select className="w-full rounded-md bg-white text-black border border-white/10 px-3 py-2" value={state.founder.year} onChange={(e)=>setState(s=>({...s, founder:{...s.founder, year:e.target.value}}))}>
                        <option className="text-black" value="">Select...</option>
                        {years.map(x=> <option className="text-black" key={x} value={x}>{x}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm mb-1">GitHub</label>
                      <input type="url" className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2" value={state.founder.github} onChange={(e)=>setState(s=>({...s, founder:{...s.founder, github:e.target.value}}))} placeholder="https://github.com/username" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">LinkedIn</label>
                      <input type="url" className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2" value={state.founder.linkedin} onChange={(e)=>setState(s=>({...s, founder:{...s.founder, linkedin:e.target.value}}))} placeholder="https://linkedin.com/in/..." />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Website</label>
                      <input type="url" className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2" value={state.founder.website} onChange={(e)=>setState(s=>({...s, founder:{...s.founder, website:e.target.value}}))} placeholder="https://example.com" />
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-1">Idea file (pdf/docx) *</label>
                      <input type="file" accept=".pdf,.doc,.docx" onChange={(e)=>setState(s=>({...s, attachments:{...s.attachments, idea: e.target.files?.[0] || null}}))} required />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Research document (pdf/docx) *</label>
                      <input type="file" accept=".pdf,.doc,.docx" onChange={(e)=>setState(s=>({...s, attachments:{...s.attachments, research: e.target.files?.[0] || null}}))} required />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-1">College ID (image/pdf) *</label>
                      <input type="file" accept="image/*,.pdf" onChange={(e)=>setState(s=>({...s, attachments:{...s.attachments, collegeId: e.target.files?.[0] || null}}))} required />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Aadhaar copy (image/pdf) *</label>
                      <input type="file" accept="image/*,.pdf" onChange={(e)=>setState(s=>({...s, attachments:{...s.attachments, aadhaar: e.target.files?.[0] || null}}))} required />
                      <p className="text-xs text-vsie-muted mt-1">Prefer a masked copy (show last 4 digits only). Your data is handled per policy.</p>
                    </div>
                  </div>
                  {feeAmount > 0 && (
                    <div className="rounded-lg border border-white/10 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">Registration Fee</h4>
                          <p className="text-vsie-muted text-sm">Amount: ₹{feeAmount}</p>
                        </div>
                        {!state.payment.paid ? (
                          <button type="button" onClick={handlePay} disabled={!razorpayKey} className="rounded-xl px-4 py-2 bg-vsie-accent text-white font-semibold disabled:opacity-60">Pay with Razorpay</button>
                        ) : (
                          <span className="text-green-400 text-sm">Paid • Txn: {state.payment.txnId}</span>
                        )}
                      </div>
                      {!razorpayKey && (
                        <p className="text-xs text-vsie-muted mt-2">Payment disabled — set NEXT_PUBLIC_RAZORPAY_KEY to enable.</p>
                      )}
                    </div>
                  )}
                  <div className="mt-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={state.consent} onChange={(e)=>setState(s=>({...s, consent: e.target.checked}))} />
                      <span>
                        I agree to the Terms & Privacy Policy and consent to VIC storing my documents for review.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Footer actions */}
              <div className="mt-6 flex items-center justify-between">
                <button type="button" onClick={goPrev} disabled={step===1} className="rounded-xl px-4 py-2 border border-white/10 text-white/90 disabled:opacity-50">Back</button>
                {step < 3 ? (
                  <button type="button" onClick={goNext} disabled={!canGoNext} className="rounded-xl px-5 py-2 bg-vsie-accent text-white font-semibold disabled:opacity-50">Next</button>
                ) : (
                  <button type="submit" disabled={!canGoNext || submitting} className="rounded-xl px-5 py-2 bg-vsie-accent text-white font-semibold disabled:opacity-50">
                    {submitting ? 'Submitting…' : 'Submit application'}
                  </button>
                )}
              </div>
              {message && <p className="mt-4 text-sm text-vsie-muted">{message}</p>}
              <p className="mt-4 text-xs text-white/50">This form collects information to evaluate your application for VIC incubation. Sensitive identity documents should be masked where possible. For questions, contact vic@vidya.edu.</p>
              {Boolean(recaptchaSiteKey) && (
                <p className="mt-1 text-[11px] text-white/40">
                  This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.
                </p>
              )}
            </form>

            <div className="mt-6 text-center text-sm text-white/60">
              <Link href="/">← Back to home</Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
