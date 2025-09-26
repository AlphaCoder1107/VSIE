export function assetUrl(path) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || ''
  // Ensure we don't double-prefix if a full URL is passed
  if (/^https?:\/\//i.test(path)) return path
  // Encode spaces and special characters, preserve slashes
  return encodeURI(`${base}${path}`)
}
