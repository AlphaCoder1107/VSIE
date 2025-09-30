import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { supabase } from '@/lib/supabaseClient'

export default function OpsEvents() {
  const [session, setSession] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ slug: '', name: '', price_paise: '', active: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null))
    const { data: authSub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => authSub.subscription.unsubscribe()
  }, [])

  const load = async () => {
    if (!session) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ops-list-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      })
      const out = await res.json()
      if (!res.ok || !out.ok) throw new Error(out?.error || `Failed (${res.status})`)
      setEvents(out.events || [])
    } catch (e) { setMessage(String(e?.message || e)) }
    setLoading(false)
  }

  useEffect(() => { load() }, [session])

  const upsert = async (payload) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ops-upsert-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(payload)
      })
      const out = await res.json()
      if (!res.ok || !out.ok) throw new Error(out?.error || `Failed (${res.status})`)
      await load()
      setForm({ slug: '', name: '', price_paise: '', active: true })
    } catch (e) { alert(String(e?.message || e)) }
  }

  return (
    <>
      <Head><title>Ops — Manage Events</title><meta name="robots" content="noindex" /></Head>
      <div className="min-h-screen bg-vsie-900">
        <Navbar />
        <main className="py-24">
          <div className="container max-w-5xl">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold">Manage Events (Ops)</h1>
              <Link href="/" className="rounded-xl px-4 py-2 bg-white/10 text-white">Home</Link>
            </div>
            {!session ? (
              <p className="text-vsie-muted">Please log in with an authorized Ops account.</p>
            ) : (
              <div className="grid gap-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="text-white/70 text-sm mb-2">Create / Update Event</div>
                  <div className="grid md:grid-cols-4 gap-2">
                    <input value={form.slug} onChange={(e)=>setForm({...form, slug: e.target.value})} placeholder="slug (unique, e.g., ai-hackathon-nov-2025)" className="rounded-lg bg-white text-black px-3 py-2 text-sm" />
                    <input value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} placeholder="name (optional)" className="rounded-lg bg-white text-black px-3 py-2 text-sm" />
                    <input value={form.price_paise} onChange={(e)=>setForm({...form, price_paise: e.target.value})} placeholder="price_paise (optional)" className="rounded-lg bg-white text-black px-3 py-2 text-sm" />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e)=>setForm({...form, active: e.target.checked})} /> Active</label>
                  </div>
                  <div className="mt-3"><button onClick={()=>upsert({ ...form, price_paise: form.price_paise ? Number(form.price_paise) : undefined })} className="px-3 py-2 rounded-lg bg-vsie-accent text-white">Save</button></div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-auto">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-white/70 text-sm">Events</div>
                    <button onClick={load} className="px-3 py-2 rounded-lg bg-white/10 text-white">Refresh</button>
                  </div>
                  {loading ? (
                    <p className="text-vsie-muted">Loading…</p>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-white/70">
                          <th className="py-2 pr-4">Slug</th>
                          <th className="py-2 pr-4">Name</th>
                          <th className="py-2 pr-4">Price (₹)</th>
                          <th className="py-2 pr-4">Active</th>
                          <th className="py-2 pr-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.map(ev => (
                          <tr key={ev.slug} className="border-t border-white/10">
                            <td className="py-2 pr-4 font-mono">{ev.slug}</td>
                            <td className="py-2 pr-4">{ev.name || '—'}</td>
                            <td className="py-2 pr-4">{((ev.price_paise ?? 0) / 100).toFixed(2)}</td>
                            <td className="py-2 pr-4">{ev.active ? 'true' : 'false'}</td>
                            <td className="py-2 pr-4">
                              <div className="flex items-center gap-2">
                                <button onClick={()=>setForm({ slug: ev.slug, name: ev.name || '', price_paise: ev.price_paise ?? '', active: !!ev.active })} className="px-2 py-1 rounded bg-white/10 text-xs">Edit</button>
                                <button onClick={()=>upsert({ slug: ev.slug, active: !ev.active })} className="px-2 py-1 rounded bg-white/10 text-xs">{ev.active ? 'Disable' : 'Enable'}</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {events.length === 0 && (<tr><td className="py-6 text-center text-white/60" colSpan={5}>No events</td></tr>)}
                      </tbody>
                    </table>
                  )}
                  {message && <p className="mt-3 text-sm text-red-400">{message}</p>}
                </div>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
