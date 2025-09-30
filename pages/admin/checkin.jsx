import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { supabase } from '@/lib/supabaseClient'

export default function AdminCheckin() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [session, setSession] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [message, setMessage] = useState('')
  const [eventSlug, setEventSlug] = useState('')
  const [result, setResult] = useState(null)
  // New: status of last scan: 'idle' | 'success' | 'already' | 'error'
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null))
    const { data: authSub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => authSub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!scanning) return
    let stream; let raf
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          tick()
        }
      } catch (e) { setMessage(String(e.message || e)) }
    }
    const tick = async () => {
      if (!videoRef.current || !canvasRef.current) { raf = requestAnimationFrame(tick); return }
      const v = videoRef.current
      const c = canvasRef.current
      const ctx = c.getContext('2d')
      c.width = v.videoWidth; c.height = v.videoHeight
      ctx.drawImage(v, 0, 0, c.width, c.height)
      try {
        const { default: jsQR } = await import('jsqr')
        const imgData = ctx.getImageData(0, 0, c.width, c.height)
        const code = jsQR(imgData.data, imgData.width, imgData.height)
        if (code && code.data) {
          setScanning(false)
          await handleScan(code.data)
          return
        }
      } catch (e) { /* ignore */ }
      raf = requestAnimationFrame(tick)
    }
    start()
    return () => { if (raf) cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()) }
  }, [scanning])

  const handleScan = async (payload) => {
    try {
      setMessage('')
      setResult(null)
      setStatus('idle')
      // Payload may be a URL with ?code=&id= or a JSON with {code,id}
      let code, id
      try {
        const u = new URL(payload)
        code = u.searchParams.get('code')
        id = Number(u.searchParams.get('id')) || undefined
      } catch {
        try { const j = JSON.parse(payload); code = j.code; id = j.id } catch { code = payload }
      }
      const token = session?.access_token
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-checkin-seminar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code, id, event_slug: eventSlug || undefined })
      })
      const out = await res.json()
      if (!res.ok || !out.ok) throw new Error(out?.error || `Failed (${res.status})`)
      setResult(out.row)
      if (out.already) {
        setStatus('already')
        if (navigator.vibrate) navigator.vibrate([120, 60, 120])
      } else {
        setStatus('success')
        if (navigator.vibrate) navigator.vibrate(80)
      }
    } catch (e) {
      setStatus('error')
      setMessage(String(e?.message || e))
      if (navigator.vibrate) navigator.vibrate([200, 80, 200])
    }
  }

  const statusBox = () => {
    if (!result && !message) return null
    if (status === 'already') {
      return (
        <div className="mt-4 text-sm bg-red-500/10 border border-red-500/40 text-red-300 rounded-lg p-3">
          <div className="font-semibold">Warning: Ticket already used</div>
          <div className="mt-1">
            <span className="text-white/70">Code:</span> <span className="font-mono">{result?.registration_code}</span>
          </div>
          {result?.checked_in_at && (
            <div className="mt-1"><span className="text-white/70">Checked in at:</span> {new Date(result.checked_in_at).toLocaleString()}</div>
          )}
          {result?.checked_in_by && (
            <div className="mt-1"><span className="text-white/70">By:</span> {result.checked_in_by}</div>
          )}
          <div className="mt-2 text-xs text-white/70">Block entry. This QR is single-use and was already redeemed.</div>
        </div>
      )
    }
    if (status === 'success') {
      return (
        <div className="mt-4 text-sm bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 rounded-lg p-3">
          <div className="font-semibold">Checked in successfully</div>
          <div className="mt-1">
            <span className="text-white/70">Code:</span> <span className="font-mono">{result?.registration_code}</span>
          </div>
          {result?.checked_in_at && (
            <div className="mt-1"><span className="text-white/70">At:</span> {new Date(result.checked_in_at).toLocaleString()}</div>
          )}
        </div>
      )
    }
    if (status === 'error') {
      return <div className="mt-4 text-sm bg-red-500/10 border border-red-500/40 text-red-300 rounded-lg p-3">{message}</div>
    }
    return null
  }

  return (
    <>
      <Head><title>Admin — Check-in</title><meta name="robots" content="noindex" /></Head>
      <div className="min-h-screen bg-vsie-900">
        <Navbar />
        <main className="py-24">
          <div className="container max-w-5xl">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold">QR Check-in</h1>
              <Link href="/admin" className="rounded-xl px-4 py-2 bg-white/10 text-white">Back to Admin</Link>
            </div>
            {!session ? (
              <p className="text-vsie-muted">Please <Link href="/admin/login" className="underline">log in</Link>.</p>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Event slug (optional, restricts to event)</label>
                  <input value={eventSlug} onChange={(e)=>setEventSlug(e.target.value)} className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm placeholder-white/50" placeholder="ai-hackathon-nov-2025" />
                  <div className="mt-3 flex items-center gap-2">
                    <button onClick={()=>{ setResult(null); setMessage(''); setStatus('idle'); setScanning(true) }} disabled={scanning} className="px-3 py-2 rounded-lg bg-vsie-accent text-white disabled:opacity-50">Start scanning</button>
                    <button onClick={()=>setScanning(false)} className="px-3 py-2 rounded-lg bg-white/10 text-white">Stop</button>
                    {!scanning && (
                      <button onClick={()=>{ setResult(null); setMessage(''); setStatus('idle'); setScanning(true) }} className="px-3 py-2 rounded-lg bg-white/10 text-white">Scan next</button>
                    )}
                  </div>
                  {statusBox()}
                </div>
                <div>
                  <video ref={videoRef} className="w-full rounded-lg bg-black/50" muted playsInline />
                  <canvas ref={canvasRef} className="hidden" />
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
