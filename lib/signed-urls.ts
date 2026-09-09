import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

// Signed URLs for private-bucket files, reused across renders.
//
// createSignedUrls mints a fresh token every call, so the same attachment came
// back under a different query string on every page load — a guaranteed browser
// cache miss, meaning the preview re-downloaded the full image each time you
// opened a broadcast. Reusing a still-valid URL makes the image cacheable.
//
// Keyed by bucket + path, not by user: a signed URL authorises an object, and
// the caller has already passed RLS on the row that names the path (and the
// paths themselves are organization-scoped). The store is per server instance
// and bounded; a miss just mints a new URL.

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days, as before
// Stop handing out a URL a day before it dies, so nothing expires mid-view.
const SAFETY_MARGIN_MS = 24 * 60 * 60 * 1000
const MAX_ENTRIES = 500

const store = new Map<string, { url: string; expiresAt: number }>()

export async function signedUrls(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  bucket: string,
  paths: string[],
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<Record<string, string>> {
  const now = Date.now()
  const urls: Record<string, string> = {}
  const missing: string[] = []

  for (const path of paths) {
    const hit = store.get(`${bucket}/${path}`)
    if (hit && hit.expiresAt - SAFETY_MARGIN_MS > now) urls[path] = hit.url
    else missing.push(path)
  }

  if (missing.length === 0) return urls

  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrls(missing, ttlSeconds)

  ;(data ?? []).forEach((entry, i) => {
    if (!entry.signedUrl) return
    const path = missing[i]
    urls[path] = entry.signedUrl
    store.set(`${bucket}/${path}`, {
      url: entry.signedUrl,
      expiresAt: now + ttlSeconds * 1000,
    })
  })

  if (store.size > MAX_ENTRIES) {
    for (const [key, value] of store) {
      if (store.size <= MAX_ENTRIES && value.expiresAt > now) break
      store.delete(key)
    }
  }

  return urls
}
