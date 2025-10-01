export function assetUrl(path) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || ''
  // Proxy remote images via Supabase Edge Function to bypass CORS/hotlink issues
  if (/^https?:\/\//i.test(path)) {
    const supa = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supa) {
      try {
        const u = new URL(path)
        const sup = new URL(supa)
        // If it's our own Supabase Storage public URL, load it directly (no proxy)
        if (u.host === sup.host && u.pathname.startsWith('/storage/v1/object/public/')) {
          return path
        }
      } catch { /* fall through to proxy */ }
      // Otherwise proxy external hosts for reliability
      return `${supa}/functions/v1/image-proxy?url=${encodeURIComponent(path)}&t=${Date.now()}`
    }
    return path
  }
  // Encode spaces and special characters, preserve slashes
  return encodeURI(`${base}${path}`)
}
