export async function fetchPublicEvents(baseUrl, anonKey, limit = 50) {
  try {
    const res = await fetch(`${baseUrl}/functions/v1/public-list-events?t=${Date.now()}`, {
      method: 'GET',
      headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` },
      cache: 'no-store'
    })
    const out = await res.json()
    if (!res.ok || !out?.events) throw new Error(out?.error || `Failed (${res.status})`)
    const rows = out.events || []
    // Map to card schema; best-effort fields
    const mapped = rows.map((e) => ({
      slug: e.slug,
      title: e.title || e.name || e.slug,
      excerpt: e.excerpt || '',
      date: e.date || e.created_at || '',
      location: e.location || '',
      image: e.image_url || '/images/startups/Expo.jpg' // default fallback
    }))
    return mapped
  } catch (_) {
    return []
  }
}
