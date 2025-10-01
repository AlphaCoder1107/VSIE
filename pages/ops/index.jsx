import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { supabase } from '@/lib/supabaseClient'
import { assetUrl } from '@/lib/url'

export default function OpsEvents() {
  const [session, setSession] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ slug: '', name: '', price_paise: '', active: true, image_url: '', title: '', excerpt: '', date: '', location: '' })
  const [editingSlug, setEditingSlug] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [uploading, setUploading] = useState(false)

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
      setEditingSlug('')
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
                    <input value={form.slug} onChange={(e)=>setForm({...form, slug: e.target.value})} placeholder="slug (unique, e.g., ai-hackathon-nov-2025)" className="rounded-lg bg-white !text-black placeholder-black/60 px-3 py-2 text-sm" />
                    <input value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} placeholder="name (optional)" className="rounded-lg bg-white !text-black placeholder-black/60 px-3 py-2 text-sm" />
                    <input value={form.price_paise} onChange={(e)=>setForm({...form, price_paise: e.target.value})} placeholder="price_paise (optional)" className="rounded-lg bg-white !text-black placeholder-black/60 px-3 py-2 text-sm" />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e)=>setForm({...form, active: e.target.checked})} /> Active</label>
                  </div>
                  <button className="mt-3 text-xs underline text-white/70" onClick={()=>setShowMore(v=>!v)}>{showMore ? 'Hide' : 'More'} fields</button>
                  {showMore && (
                    <div className="mt-3 grid md:grid-cols-2 gap-2">
                      <div className="flex gap-2 items-start">
                        <input value={form.image_url} onChange={(e)=>setForm({...form, image_url: e.target.value})} placeholder="image_url (public URL or /images/...)" className="flex-1 rounded-lg bg-white !text-black placeholder-black/60 px-3 py-2 text-sm" />
                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-sm cursor-pointer" title="Uploads to events/<slug>/cover and replaces previous image">
                          <input type="file" accept="image/*" className="hidden" onChange={async (e)=>{
                            const file = e.target.files?.[0]
                            if (!file) return
                            try {
                              setUploading(true)
                              const fd = new FormData()
                              fd.append('file', file)
                              fd.append('slug', form.slug || editingSlug || 'misc')
                              const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ops-upload-image`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${session.access_token}` },
                                body: fd
                              })
                              const out = await res.json()
                              if (!res.ok || !out?.ok) throw new Error(out?.error || `Upload failed (${res.status})`)
                              if (out.publicUrl) setForm(f=>({...f, image_url: out.publicUrl}))
                            } catch (err) {
                              alert(`Upload failed: ${err?.message || err}`)
                            } finally {
                              setUploading(false)
                              e.target.value = ''
                            }
                          }} />
                          {uploading ? 'Uploading…' : (form.image_url ? 'Upload again' : 'Upload')}
                        </label>
                      </div>
                      <input value={form.title} onChange={(e)=>setForm({...form, title: e.target.value})} placeholder="title (display)" className="rounded-lg bg-white !text-black placeholder-black/60 px-3 py-2 text-sm" />
                      <input value={form.excerpt} onChange={(e)=>setForm({...form, excerpt: e.target.value})} placeholder="excerpt (short description)" className="rounded-lg bg-white !text-black placeholder-black/60 px-3 py-2 text-sm" />
                      <input value={form.date} onChange={(e)=>setForm({...form, date: e.target.value})} placeholder="date (YYYY-MM-DD)" className="rounded-lg bg-white !text-black placeholder-black/60 px-3 py-2 text-sm" />
                      <input value={form.location} onChange={(e)=>setForm({...form, location: e.target.value})} placeholder="location (e.g., Main Auditorium)" className="rounded-lg bg-white !text-black placeholder-black/60 px-3 py-2 text-sm" />
                    </div>
                  )}
                  {showMore && form.image_url && (
                    <div className="mt-3">
                      <div className="text-white/70 text-sm mb-1">Preview</div>
                      <div className="rounded-xl overflow-hidden border border-white/10 max-w-xl">
                        <img src={assetUrl(form.image_url)} alt="Preview" className="w-full h-auto" style={{aspectRatio:'16/9', objectFit:'cover'}} />
                      </div>
                    </div>
                  )}
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
                          <tr key={ev.slug} className="border-t border-white/10 align-top">
                            <td className="py-2 pr-4 font-mono">{ev.slug}</td>
                            <td className="py-2 pr-4">
                              {editingSlug === ev.slug ? (
                                <input
                                  value={form.name}
                                  onChange={(e)=>setForm(f=>({...f, name:e.target.value}))}
                                  placeholder="name"
                                  className="rounded bg-white !text-black placeholder-black/60 px-2 py-1 text-xs w-44"
                                />
                              ) : (
                                ev.name || '—'
                              )}
                            </td>
                            <td className="py-2 pr-4">
                              {editingSlug === ev.slug ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-white/70 text-xs">₹</span>
                                  <input
                                    value={form.price_paise === '' || form.price_paise == null ? '' : String((Number(form.price_paise)||0)/100)}
                                    onChange={(e)=>{
                                      const val = e.target.value
                                      const rupees = val === '' ? '' : Number(val)
                                      setForm(f=>({...f, price_paise: val === '' ? '' : Math.round((isNaN(rupees)?0:rupees)*100)}))
                                    }}
                                    placeholder="0.00"
                                    className="rounded bg-white !text-black placeholder-black/60 px-2 py-1 text-xs w-24"
                                  />
                                </div>
                              ) : (
                                ((ev.price_paise ?? 0) / 100).toFixed(2)
                              )}
                            </td>
                            <td className="py-2 pr-4">
                              {editingSlug === ev.slug ? (
                                <label className="inline-flex items-center gap-2 text-xs">
                                  <input type="checkbox" checked={!!form.active} onChange={(e)=>setForm(f=>({...f, active:e.target.checked}))} /> Active
                                </label>
                              ) : (
                                ev.active ? 'true' : 'false'
                              )}
                            </td>
                            <td className="py-2 pr-4">
                              <div className="flex items-center gap-2">
                                {editingSlug === ev.slug ? (
                                  <>
                                    <button
                                      onClick={()=>upsert({ slug: ev.slug, name: form.name || null, price_paise: form.price_paise === '' ? null : Number(form.price_paise), active: !!form.active, image_url: form.image_url || null, title: form.title || null, excerpt: form.excerpt || null, date: form.date || null, location: form.location || null })}
                                      className="px-2 py-1 rounded bg-vsie-accent text-white text-xs"
                                    >Save</button>
                                    <button
                                      onClick={()=>{ setEditingSlug(''); setForm({ slug: '', name: '', price_paise: '', active: true, image_url: '', title: '', excerpt: '', date: '', location: '' }) }}
                                      className="px-2 py-1 rounded bg-white/10 text-xs"
                                    >Cancel</button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={()=>{ setEditingSlug(ev.slug); setShowMore(false); setForm({ slug: ev.slug, name: ev.name || '', price_paise: ev.price_paise ?? '', active: !!ev.active, image_url: ev.image_url || '', title: ev.title || '', excerpt: ev.excerpt || '', date: ev.date || '', location: ev.location || '' }) }}
                                      className="px-2 py-1 rounded bg-white/10 text-xs"
                                    >Edit</button>
                                    <button onClick={()=>upsert({ slug: ev.slug, active: !ev.active })} className="px-2 py-1 rounded bg-white/10 text-xs">{ev.active ? 'Disable' : 'Enable'}</button>
                                  </>
                                )}
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
