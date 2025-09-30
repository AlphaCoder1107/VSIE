import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { supabase } from '@/lib/supabaseClient'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
      const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!SUPABASE_URL || !SUPABASE_ANON) {
        setMessage('Auth not configured. Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY at build time.')
        return
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const extra = error.status ? ` (status ${error.status})` : ''
        setMessage((error.message || 'Sign-in failed') + extra)
      } else {
        setMessage('Signed in. Redirecting…')
        // Give the client a brief moment to persist the session before navigation
        setTimeout(() => {
          window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/admin`
        }, 200)
      }
    } catch (err) {
      console.error('Sign-in exception', err)
      setMessage('Network/auth error. See console for details.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Admin Login — VIC</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-vsie-900">
  <Navbar skipManagerProbe={true} />
        <main className="py-24">
          <div className="container max-w-md">
            <h1 className="text-3xl font-bold mb-6">Admin Login</h1>
            <form onSubmit={onSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6 grid gap-4">
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input type="email" className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2" value={email} onChange={(e)=>setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm mb-1">Password</label>
                <input type="password" className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2" value={password} onChange={(e)=>setPassword(e.target.value)} required />
              </div>
              <button type="submit" disabled={loading} className="rounded-xl px-5 py-2 bg-vsie-accent text-white font-semibold disabled:opacity-50">{loading ? 'Signing in…' : 'Sign in'}</button>
              {message && <p className="text-sm text-vsie-muted">{message}</p>}
            </form>
            <p className="mt-6 text-sm text-white/60"><Link href="/">← Back to site</Link></p>
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
