import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { supabase } from '@/lib/supabaseClient'

export default function AdminHome() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

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
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-list-applications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ limit: 100, query: debounced })
        })
        const out = await res.json()
        if (!res.ok) throw new Error(out?.error || `Request failed (${res.status})`)
        setApps(out.rows || [])
      } catch (e) {
        setMessage(String(e?.message || e))
      }
      setLoading(false)
    }
    load()
  }, [session, debounced])

  // Debounce the search input to avoid spamming the function
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Client-side filter as a fallback and for immediate UI feedback
  const filtered = useMemo(() => {
    const input = (search || '').trim()
    if (!input) return apps
    const tokens = input
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter(Boolean)
    const hasTokens = tokens.length > 0
    const numberToken = input.replace(/\D/g, '') // full digits in the input

    return apps.filter((a) => {
      const norm = (s) => (s ?? '').toString().toLowerCase()
      const digits = (s) => (s ?? '').toString().replace(/\D/g, '')

      const code = norm(a.application_code)
      const codeDigits = digits(a.application_code)
      const startup = norm(a.startup_name)
      const stage = norm(a.stage)
      const idStr = String(a.id)
      const foundersStr = Array.isArray(a.founders)
        ? norm(a.founders.map(f => [f?.name, f?.email, f?.phone].filter(Boolean).join(' ')).join(' '))
        : ''

      // Each token must match somewhere (AND semantics)
      const allTokensMatch = tokens.every((t) => {
        const isNum = /^\d+$/.test(t)
        if (isNum) {
          return idStr.includes(t) || codeDigits.includes(t)
        }
        return (
          code.includes(t) ||
          startup.includes(t) ||
          stage.includes(t) ||
          foundersStr.includes(t)
        )
      })

      // Additionally, if the input contains digits, allow a loose digits match against code
      const looseDigitsOk = numberToken.length >= 2 ? codeDigits.includes(numberToken) || numberToken.includes(codeDigits) : true

      return (!hasTokens || allTokensMatch) && looseDigitsOk
    })
  }, [apps, search])

  // Export helpers
  const exportToXlsx = async () => {
    if (!filtered.length) return
    const XLSX = await import('xlsx')
    const rows = filtered.map((a) => ({
      ID: a.id,
      Created: a.created_at ? new Date(a.created_at).toLocaleString() : '',
      Code: a.application_code || '',
      Startup: a.startup_name || '',
      Stage: a.stage || '',
      Founder: Array.isArray(a.founders) && a.founders[0]?.name ? a.founders[0].name : ''
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Applications')
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
    XLSX.writeFile(wb, `applications_${stamp}.xlsx`)
  }

  const exportToPdf = async () => {
    if (!filtered.length) return
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF({ orientation: 'landscape' })
    const head = [['ID', 'Created', 'Code', 'Startup', 'Stage', 'Founder']]
    const body = filtered.map((a) => ([
      String(a.id),
      a.created_at ? new Date(a.created_at).toLocaleString() : '',
      a.application_code || '',
      a.startup_name || '',
      a.stage || '',
      (Array.isArray(a.founders) && a.founders[0]?.name) ? a.founders[0].name : ''
    ]))
    autoTable(doc, { head, body, styles: { fontSize: 8 }, headStyles: { fillColor: [40, 40, 40] } })
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
    doc.save(`applications_${stamp}.pdf`)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/admin/login') }

  return (
    <>
      <Head>
        <title>Admin — VIC</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-vsie-900">
        <Navbar />
        <main className="py-24">
          <div className="container max-w-5xl">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold">Admin Panel</h1>
              {session ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white/70">Signed in as {session?.user?.email}</span>
                  <button onClick={signOut} className="rounded-xl px-4 py-2 bg-white/10 text-white">Sign out</button>
                </div>
              ) : (
                <Link href="/admin/login" className="rounded-xl px-4 py-2 bg-vsie-accent text-white">Login</Link>
              )}
            </div>
            <p className="mb-6 text-xs text-white/50">Only emails in the ADMIN_EMAILS function secret can access data.</p>
            {!session ? (
              <p className="text-vsie-muted">Please <Link href="/admin/login" className="underline">log in</Link> to view applications.</p>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-auto">
                <div className="mb-4 flex items-center gap-2 flex-wrap">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by code, startup, stage, or ID…"
                    className="w-full md:w-80 rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-vsie-accent"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="px-3 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/20"
                    >Clear</button>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={exportToXlsx}
                      disabled={!filtered.length}
                      className="px-3 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/20 disabled:opacity-50"
                      title={!filtered.length ? 'No data to export' : 'Export to Excel'}
                    >Export Excel</button>
                    <button
                      onClick={exportToPdf}
                      disabled={!filtered.length}
                      className="px-3 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/20 disabled:opacity-50"
                      title={!filtered.length ? 'No data to export' : 'Export to PDF'}
                    >Export PDF</button>
                  </div>
                </div>
                {loading ? (
                  <p className="text-vsie-muted">Loading applications…</p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-white/70">
                        <th className="py-2 pr-4">ID</th>
                        <th className="py-2 pr-4">Created</th>
                        <th className="py-2 pr-4">Code</th>
                        <th className="py-2 pr-4">Startup</th>
                        <th className="py-2 pr-4">Stage</th>
                        <th className="py-2 pr-4">Founder</th>
                        <th className="py-2 pr-4">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 && (
                        <tr>
                          <td className="py-6 text-center text-white/60" colSpan={7}>No results found.</td>
                        </tr>
                      )}
                      {filtered.map((a) => (
                        <tr key={a.id} className="border-t border-white/10">
                          <td className="py-2 pr-4">{a.id}</td>
                          <td className="py-2 pr-4">{new Date(a.created_at).toLocaleString()}</td>
                          <td className="py-2 pr-4 font-mono">{a.application_code || '—'}</td>
                          <td className="py-2 pr-4">{a.startup_name}</td>
                          <td className="py-2 pr-4">{a.stage}</td>
                          <td className="py-2 pr-4">{Array.isArray(a.founders) && a.founders[0]?.name}</td>
                          <td className="py-2 pr-4">
                            <Link href={`/admin/view?id=${a.id}`} className="inline-flex items-center rounded-lg px-3 py-1.5 bg-vsie-accent text-white text-xs font-medium hover:opacity-90">
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {message && (
                  <p className="mt-3 text-sm text-red-400">
                    {message}
                    {String(message).toLowerCase().includes('forbidden') && ' — Your email is not included in ADMIN_EMAILS. Add it to the Edge Function secrets and redeploy.'}
                  </p>
                )}
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
