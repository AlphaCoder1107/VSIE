export function assetUrl(path) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || ''
  // Proxy remote images via Supabase Edge Function to bypass CORS/hotlink issues
  if (/^https?:\/\//i.test(path)) {
    const supa = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supa) {
      const proxied = `${supa}/functions/v1/image-proxy?url=${encodeURIComponent(path)}`
      return proxied
    }
    return path
  }
  // Encode spaces and special characters, preserve slashes
  return encodeURI(`${base}${path}`)
}
