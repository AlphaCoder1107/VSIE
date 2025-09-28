import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { supabase } from '@/lib/supabaseClient'

export default function AdminHome() {
  const [session, setSession] = useState(null)
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

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
          body: JSON.stringify({ limit: 100 })
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
  }, [session])

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/admin/login` }

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
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold">Admin Panel</h1>
              {session ? (
                <button onClick={signOut} className="rounded-xl px-4 py-2 bg-white/10 text-white">Sign out</button>
              ) : (
                <Link href="/admin/login" className="rounded-xl px-4 py-2 bg-vsie-accent text-white">Login</Link>
              )}
            </div>
            {!session ? (
              <p className="text-vsie-muted">Please <Link href="/admin/login" className="underline">log in</Link> to view applications.</p>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-auto">
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
                      </tr>
                    </thead>
                    <tbody>
                      {apps.map((a) => (
                        <tr key={a.id} className="border-t border-white/10">
                          <td className="py-2 pr-4">{a.id}</td>
                          <td className="py-2 pr-4">{new Date(a.created_at).toLocaleString()}</td>
                          <td className="py-2 pr-4 font-mono">{a.application_code || '—'}</td>
                          <td className="py-2 pr-4">{a.startup_name}</td>
                          <td className="py-2 pr-4">{a.stage}</td>
                          <td className="py-2 pr-4">{Array.isArray(a.founders) && a.founders[0]?.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {message && <p className="mt-3 text-sm text-red-400">{message}</p>}
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
