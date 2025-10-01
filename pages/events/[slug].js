import Head from 'next/head'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { assetUrl } from '@/lib/url'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { getEventSlugs, getEventBySlug } from '@/lib/data'
import { supabase } from '@/lib/supabaseClient'

export default function EventDetail({ event }) {
  if (!event) return null

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', college: '', year: '' })
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [serverPricePaise, setServerPricePaise] = useState(null)
  const [isActive, setIsActive] = useState(true)

  // Load Razorpay script on client
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.Razorpay) return
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    document.body.appendChild(s)
  }, [])

  // Deep link: auto-open on #register
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash === '#register') setShowModal(true)
  }, [])

  // Fetch live event config (price, active) from Supabase Edge Function
  useEffect(() => {
    let stop = false
    const fetchLive = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/public-get-event?slug=${encodeURIComponent(event.slug)}&t=${Date.now()}`, { cache: 'no-store' })
        const out = await res.json()
        if (!stop && res.ok && out?.event) {
          setServerPricePaise(out.event.price_paise ?? null)
          setIsActive(!!out.event.active)
        }
      } catch { /* ignore */ }
    }
    fetchLive()
    const t = setInterval(fetchLive, 60_000) // periodic refresh
    return () => { stop = true; clearInterval(t) }
  }, [event.slug])

  const canSubmit = useMemo(() => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    const nameOk = form.name.trim().length >= 2
    return nameOk && emailOk
  }, [form])

  async function openCheckout() {
    setStatus('Creating order...')
    // Ensure latest price and active state before creating order
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/public-get-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: event.slug })
      })
      const out = await res.json()
      if (!res.ok || !out?.event) {
        setStatus('Registrations are currently closed for this event.')
        return null
      }
      setServerPricePaise(out.event.price_paise ?? null)
      setIsActive(!!out.event.active)
      if (!out.event.active) {
        setStatus('Registrations are closed for this event.')
        return null
      }
    } catch { /* continue with default */ }

    const amountPaise = serverPricePaise != null ? Number(serverPricePaise) : 1000
    const { data, error } = await supabase.functions.invoke('seminar-create-order', {
      body: { amount_paise: amountPaise, receipt: `sem-reg-${Date.now()}` }
    })
    if (error || !data?.order || !data?.key_id) {
      setStatus('Failed to create order. Please try again.')
      return null
    }
    setStatus('Opening payment window...')
    return data
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setStatus('')
    try {
      const created = await openCheckout()
      if (!created) return
      const { order, key_id } = created

      const options = {
        key: key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'VIC Seminar',
        description: `Entry fee for ${event.slug}`,
        order_id: order.id,
        prefill: { name: form.name, email: form.email, contact: form.phone },
        handler: async (resp) => {
          setStatus('Verifying payment...')
          const { data: verify, error: vErr } = await supabase.functions.invoke('seminar-verify-payment', {
            body: {
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_signature: resp.razorpay_signature,
              student: { ...form, event_slug: event.slug }
            }
          })
          if (vErr || !verify?.ok) {
            setStatus('Payment verification failed. Please contact us if you were charged.')
            return
          }
          setStatus(`Payment successful! Your entry no: ${verify.registration_code}`)
          setTimeout(() => setShowModal(false), 3000)
        },
        modal: { ondismiss: () => setStatus('Payment window closed.') }
      }

      // @ts-ignore
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      console.error(err)
      setStatus('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <>
      <Head>
  <title>{event.title} — VIC Events</title>
        <meta name="description" content={event.excerpt} />
      </Head>
      <div className="min-h-screen bg-vsie-900">
        <Navbar />
        <main id="main" className="py-24">
          <div className="container grid lg:grid-cols-12 gap-10">
            <article className="lg:col-span-8">
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{event.title}</h1>
              <p className="mt-3 text-vsie-muted">{event.date} • {event.location}</p>
              <div className="mt-8 rounded-2xl overflow-hidden border border-white/10">
                <Image src={assetUrl(event.image)} alt="Event cover" width={1200} height={630} className="w-full h-auto" />
              </div>
              <div className="prose prose-invert mt-8 max-w-none">
                <p>{event.description}</p>
              </div>
            </article>
            <aside className="lg:col-span-4">
              <div className="sticky top-24 space-y-4 max-w-sm mx-auto w-full">
                <button onClick={() => { setShowModal(true); setStatus('') }} disabled={!isActive} className="block w-full text-center rounded-xl px-6 py-3 bg-vsie-accent text-white font-semibold shadow hover:-translate-y-0.5 transition disabled:opacity-50 disabled:cursor-not-allowed">{isActive ? 'Register now' : 'Registrations closed'}</button>
                <div className="rounded-xl bg-vsie-800/60 border border-white/10 p-5">
                  <h3 className="font-semibold">Details</h3>
                  <ul className="mt-3 text-vsie-muted space-y-1">
                    <li><strong>Date:</strong> {event.date}</li>
                    <li><strong>Time:</strong> {event.time}</li>
                    <li><strong>Venue:</strong> {event.location}</li>
                    {serverPricePaise != null && <li><strong>Price:</strong> ₹{(serverPricePaise/100).toFixed(2)}</li>}
                    {!isActive && <li className="text-red-400"><strong>Registrations closed</strong></li>}
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </main>
        <Footer />
      </div>
      {/* Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white text-black rounded-xl w-full max-w-lg p-5 relative">
            <button onClick={() => setShowModal(false)} className="absolute right-3 top-3 text-black/60">✕</button>
            <h3 className="text-xl font-semibold text-black">Seminar Registration {serverPricePaise != null ? `(₹${(serverPricePaise/100).toFixed(2)})` : '(₹10)'}</h3>
            <form onSubmit={onSubmit} className="mt-3 space-y-3">
              <input type="hidden" value={event.slug} />
              <div>
                <label className="text-sm text-black">Name</label>
                <input
                  required
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 !text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-vsie-accent focus:border-vsie-accent"
                  value={form.name}
                  onChange={(e)=>setForm(f=>({...f, name:e.target.value}))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-black">Email</label>
                  <input
                    type="email"
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 !text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-vsie-accent focus:border-vsie-accent"
                    value={form.email}
                    onChange={(e)=>setForm(f=>({...f, email:e.target.value}))}
                  />
                </div>
                <div>
                  <label className="text-sm text-black">Phone</label>
                  <input
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 !text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-vsie-accent focus:border-vsie-accent"
                    value={form.phone}
                    onChange={(e)=>setForm(f=>({...f, phone:e.target.value}))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-black">College</label>
                  <input
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 !text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-vsie-accent focus:border-vsie-accent"
                    value={form.college}
                    onChange={(e)=>setForm(f=>({...f, college:e.target.value}))}
                  />
                </div>
                <div>
                  <label className="text-sm text-black">Year</label>
                  <input
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 !text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-vsie-accent focus:border-vsie-accent"
                    value={form.year}
                    onChange={(e)=>setForm(f=>({...f, year:e.target.value}))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={!canSubmit || submitting} className="px-5 py-2 rounded-md bg-vsie-accent text-white disabled:opacity-60">{submitting ? 'Processing…' : 'Pay ₹10 & Register'}</button>
              </div>
              {status && <p className="text-sm text-black mt-2">{status}</p>}
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export async function getStaticPaths() {
  const slugs = getEventSlugs()
  return {
    paths: slugs.map((slug) => ({ params: { slug } })),
    fallback: 'blocking'
  }
}

export async function getStaticProps({ params }) {
  const event = getEventBySlug(params.slug)
  return { props: { event } }
}
