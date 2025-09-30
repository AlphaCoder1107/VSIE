import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { supabase } from '@/lib/supabaseClient'

export default function AdminSeminars() {
  const [session, setSession] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [slug, setSlug] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null))
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => authSub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function load() {
      if (!session) { setLoading(false); return }
      setLoading(true)
      const token = session?.access_token
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-list-seminars`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ limit: 500, query: debounced, event_slug: slug.trim() })
        })
        const out = await res.json()
        if (!res.ok) throw new Error(out?.error || `Request failed (${res.status})`)
        setRows(out.rows || [])
      } catch (e) {
        setMessage(String(e?.message || e))
      }
      setLoading(false)
    }
    load()
  }, [session, debounced, slug])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const filtered = useMemo(() => {
    const q = debounced
    if (!q) return rows
    const tokens = q.toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean)
    const digits = q.replace(/\D/g, '')
    return rows.filter((r) => {
      const norm = (s) => (s ?? '').toString().toLowerCase()
      const code = norm(r.registration_code)
      const codeDigits = (r.registration_code || '').replace(/\D/g, '')
      const name = norm(r.student_name)
      const email = norm(r.student_email)
      const phone = norm(r.student_phone)
      const ev = norm(r.event_slug)
      const all = tokens.every((t) => {
        const isNum = /^\d+$/.test(t)
        if (isNum) return String(r.id).includes(t) || codeDigits.includes(t)
        return code.includes(t) || name.includes(t) || email.includes(t) || phone.includes(t) || ev.includes(t)
      })
      const looseDigitsOk = digits.length >= 2 ? codeDigits.includes(digits) : true
      return all && looseDigitsOk
    })
  }, [rows, debounced])

  const exportCsv = () => {
    if (!filtered.length) return
    const cols = ['id','created_at','registration_code','event_slug','student_name','student_email','student_phone','college','year','amount_paise','status']
    const header = cols.join(',')
    const lines = filtered.map(r => cols.map(k => JSON.stringify(r[k] ?? '')).join(','))
    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0,12)
    a.download = `seminar_registrations_${slug || 'all'}_${stamp}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Head>
        <title>Admin — Seminar Registrations</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-vsie-900">
        <Navbar />
        <main className="py-24">
          <div className="container max-w-6xl">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold">Seminar Registrations</h1>
              <Link href="/admin" className="rounded-xl px-4 py-2 bg-white/10 text-white">Back to Admin</Link>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-auto">
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <input value={slug} onChange={(e)=>setSlug(e.target.value)} placeholder="Filter by event slug (e.g., friday-seminar)" className="w-full md:w-72 rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm placeholder-white/50" />
                <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search by code, name, email, phone…" className="w-full md:w-80 rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm placeholder-white/50" />
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={exportCsv} disabled={!filtered.length} className="px-3 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/20 disabled:opacity-50">Export CSV</button>
                </div>
              </div>
              {loading ? (
                <p className="text-vsie-muted">Loading registrations…</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/70">
                      <th className="py-2 pr-4">ID</th>
                      <th className="py-2 pr-4">Created</th>
                      <th className="py-2 pr-4">Code</th>
                      <th className="py-2 pr-4">Event</th>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Phone</th>
                      <th className="py-2 pr-4">College</th>
                      <th className="py-2 pr-4">Year</th>
                      <th className="py-2 pr-4">Amount</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">QR</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td className="py-6 text-center text-white/60" colSpan={13}>No results</td></tr>
                    )}
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-t border-white/10">
                        <td className="py-2 pr-4">{r.id}</td>
                        <td className="py-2 pr-4">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
                        <td className="py-2 pr-4 font-mono">
                          <Link href={`/admin/seminar?id=${r.id}`} className="underline text-vsie-accent">{r.registration_code}</Link>
                        </td>
                        <td className="py-2 pr-4">{r.event_slug}</td>
                        <td className="py-2 pr-4">{r.student_name}</td>
                        <td className="py-2 pr-4">{r.student_email}</td>
                        <td className="py-2 pr-4">{r.student_phone || '—'}</td>
                        <td className="py-2 pr-4">{r.college || '—'}</td>
                        <td className="py-2 pr-4">{r.year || '—'}</td>
                        <td className="py-2 pr-4">₹{(r.amount_paise ?? 0) / 100}</td>
                        <td className="py-2 pr-4">{r.status}</td>
                        <td className="py-2 pr-4">
                          {r.qr_url ? (
                            <a href={r.qr_url} target="_blank" rel="noreferrer" className="text-vsie-accent underline">Open QR</a>
                          ) : (
                            <span className="text-white/50">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <button
                            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs"
                            title="Copy code"
                            onClick={() => navigator.clipboard.writeText(r.registration_code || '')}
                          >Copy Code</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {message && <p className="mt-3 text-sm text-red-400">{message}</p>}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
