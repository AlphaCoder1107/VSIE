import { useEffect, useState } from 'react'

export default function NotFound() {
  const [redirected, setRedirected] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
      const fullPath = window.location.pathname
      // Strip basePath if present (e.g., /VSIE)
      const path = basePath && fullPath.startsWith(basePath)
        ? fullPath.slice(basePath.length)
        : fullPath

      // Match /events/<slug> (with or without trailing slash)
      const m = path.match(/^\/events\/([^/]+)\/?$/)
      if (m && m[1]) {
        const slug = decodeURIComponent(m[1])
        const target = `${basePath}/events/view?slug=${encodeURIComponent(slug)}${window.location.hash || ''}`
        setRedirected(true)
        window.location.replace(target)
        return
      }
    } catch {/* ignore */}
  }, [])

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0f1b',color:'#fff',textAlign:'center',padding:'2rem'}}>
      <div>
        <div style={{opacity:0.7, marginBottom:'0.5rem'}}>404</div>
        <h1 style={{fontSize:'1.5rem', marginBottom:'0.75rem'}}>This page could not be found.</h1>
        <p style={{opacity:0.8}}>
          {redirected
            ? 'Redirecting to the event page...'
            : 'If you followed a link to an event, it may be available at a different URL.'}
        </p>
        {!redirected && (
          <p style={{marginTop:'1rem'}}>
            <a href={(process.env.NEXT_PUBLIC_BASE_PATH || '') + '/'} style={{color:'#79ffe1'}}>Go to homepage</a>
          </p>
        )}
      </div>
    </div>
  )
}
