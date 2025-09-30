import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { supabase } from '@/lib/supabaseClient'

export default function AdminView() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [row, setRow] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const id = router?.query?.id ? Number(router.query.id) : null

  useEffect(() => {
    if (!supabase) return
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
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-get-application`, {
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
        <title>Application — Admin — VIC</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-vsie-900">
        <Navbar />
        <main className="py-24">
          <div className="container max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">Application {id}</h1>
              <Link href="/admin" className="rounded-xl px-4 py-2 bg-white/10 text-white">Back</Link>
            </div>
            {!session ? (
              <p className="text-vsie-muted">Please <Link href="/admin/login" className="underline">log in</Link> to view this application.</p>
            ) : loading ? (
              <p className="text-vsie-muted">Loading…</p>
            ) : row ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 grid gap-6">
                {/* Header */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-white/60 text-xs">Application Code</div>
                    <div className="font-mono text-lg">{row.application_code || '—'}</div>
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

                {/* Startup summary */}
                <div>
                  <div className="text-white/60 text-xs">Startup</div>
                  <div className="font-semibold">{row.startup_name || '—'}</div>
                  <div className="text-white/80 text-sm mt-1">Stage: {row.stage || '—'}</div>
                  <div className="text-white/80 text-sm">Industry: {Array.isArray(row.industry) ? row.industry.join(', ') : (row.industry || '—')}</div>
                </div>

                {/* Narrative sections if present */}
                <div className="grid md:grid-cols-2 gap-4">
                  {row.problem && (
                    <div>
                      <div className="text-white/60 text-xs">Problem</div>
                      <p className="whitespace-pre-wrap">{row.problem}</p>
                    </div>
                  )}
                  {row.solution && (
                    <div>
                      <div className="text-white/60 text-xs">Solution</div>
                      <p className="whitespace-pre-wrap">{row.solution}</p>
                    </div>
                  )}
                </div>

                {/* Founders */}
                <div>
                  <div className="text-white/60 text-xs mb-1">Founders</div>
                  {Array.isArray(row.founders) && row.founders.length > 0 ? (
                    <ul className="space-y-1">
                      {row.founders.map((f, idx) => (
                        <li key={idx} className="text-sm">
                          <span className="font-medium">{f?.name || '—'}</span>
                          {f?.email && <> — <a className="underline" href={`mailto:${f.email}`}>{f.email}</a></>}
                          {f?.phone && <> — <a className="underline" href={`tel:${f.phone}`}>{f.phone}</a></>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-white/70 text-sm">—</p>
                  )}
                </div>

                {/* All other scalar fields */}
                <div>
                  <div className="text-white/60 text-xs mb-2">Other Details</div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {Object.entries(row)
                      .filter(([k, v]) => (
                        v !== null && typeof v !== 'object' && // scalars only
                        !['application_code','created_at','id','industry','startup_name','stage','problem','solution','attachments','attachments_signed','founders','client_ref'].includes(k)
                      ))
                      .map(([k, v]) => (
                        <div key={k} className="text-sm">
                          <div className="text-white/60 text-xs">{k}</div>
                          <div className="break-words">{String(v)}</div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Attachments */}
                <div>
                  <div className="text-white/60 text-xs mb-2">Attachments (signed links)</div>
                  <ul className="list-disc pl-6 text-sm">
                    {Object.entries(row.attachments_signed || {}).map(([k, url]) => (
                      <li key={k}><a className="text-vsie-accent underline" href={url} target="_blank" rel="noreferrer">{k}</a></li>
                    ))}
                    {Object.keys(row.attachments_signed || {}).length === 0 && <li>No attachments</li>}
                  </ul>
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
