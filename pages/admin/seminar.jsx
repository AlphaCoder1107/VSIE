import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { supabase } from '@/lib/supabaseClient'

export default function AdminSeminarDetail() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [row, setRow] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const id = router?.query?.id ? Number(router.query.id) : null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null))
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => authSub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function load() {
      if (!router.isReady) return
      if (!session || !id) { setLoading(false); return }
      setLoading(true)
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-get-seminar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ id })
        })
        const out = await res.json()
        if (!res.ok) throw new Error(out?.error || `Failed (${res.status})`)
        setRow(out.row)
      } catch (e) {
        setMessage(String(e?.message || e))
      }
      setLoading(false)
    }
    load()
  }, [session, id, router.isReady])

  return (
    <>
      <Head>
        <title>Seminar Registration — Admin — VIC</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-vsie-900">
        <Navbar />
        <main className="py-24">
          <div className="container max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">Seminar {id}</h1>
              <Link href="/admin/seminars" className="rounded-xl px-4 py-2 bg-white/10 text-white">Back</Link>
            </div>
            {!session ? (
              <p className="text-vsie-muted">Please <Link href="/admin/login" className="underline">log in</Link> to view this registration.</p>
            ) : loading ? (
              <p className="text-vsie-muted">Loading…</p>
            ) : row ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 grid gap-6">
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-white/60 text-xs">Registration Code</div>
                    <div className="font-mono text-lg">{row.registration_code || '—'}</div>
                  </div>
                  <div>
                    <div className="text-white/60 text-xs">Internal ID</div>
                    <div>{row.id}</div>
                  </div>
                  <div>
                    <div className="text-white/60 text-xs">Created</div>
                    <div>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 items-start">
                  <div>
                    <div className="text-white/60 text-xs mb-2">Student</div>
                    <div className="text-sm"><span className="font-semibold">{row.student_name}</span></div>
                    <div className="text-sm"><a className="underline" href={`mailto:${row.student_email}`}>{row.student_email}</a></div>
                    {row.student_phone && (<div className="text-sm"><a className="underline" href={`tel:${row.student_phone}`}>{row.student_phone}</a></div>)}
                    <div className="text-sm mt-2">College: {row.college || '—'}</div>
                    <div className="text-sm">Year: {row.year || '—'}</div>
                    <div className="text-sm mt-2">Event: {row.event_slug}</div>
                    <div className="text-sm">Amount: ₹{(row.amount_paise ?? 0) / 100}</div>
                    <div className="text-sm">Status: {row.status}</div>
                  </div>
                  <div>
                    <div className="text-white/60 text-xs mb-2">QR Code</div>
                    {row.qr_url ? (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3 inline-block">
                        <img src={row.qr_url} alt="QR" className="max-w-xs" />
                      </div>
                    ) : (
                      <div className="text-white/60">No QR on file.</div>
                    )}
                    {row.qr_url && (
                      <div className="mt-2 text-sm">
                        <a className="text-vsie-accent underline" href={row.qr_url} target="_blank" rel="noreferrer">Open in new tab</a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
                    onClick={() => navigator.clipboard.writeText(row.registration_code || '')}
                  >Copy Code</button>
                </div>
              </div>
            ) : (
              <p className="text-red-400">{message || 'Not found or access denied.'}</p>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
