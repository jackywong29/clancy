import 'server-only'
import { createClient } from '@/lib/supabase/server'

// Signed URLs for private-bucket files, reused across renders.
//
// createSignedUrls mints a fresh token every call, so the same attachment came
// back under a different query string on every page load — a guaranteed browser
// cache miss, meaning the preview re-downloaded the full image each time you
// opened a broadcast. Reusing a still-valid URL makes the image cacheable.
//
// The cache key carries the caller's organization. A signed URL is an
// unauthenticated bearer capability, and a cache hit returns before
// createSignedUrls — which is the only point where storage RLS is evaluated.
// A key of bucket + path alone is therefore shared by every tenant served by
// the same server instance, so one org's hit could hand back a token minted
// under another org's session. Scoping the key to orgId keeps the invariant
// that a URL is only ever reused by the organization it was minted for; a miss
// just mints a new one under the caller's own session and RLS decides.
//
// The store is per server instance and bounded.

const DEFAULT_TTL_SECONDS = 15 * 60 // 15 minutes: long enough to render a page
// Stop handing out a URL shortly before it dies, so nothing expires mid-view.
// Proportional to the lifetime, because a fixed margin larger than a short TTL
// would mark every entry stale on arrival and defeat the cache entirely.
const MAX_SAFETY_MARGIN_MS = 5 * 60 * 1000
const MAX_ENTRIES = 500

const store = new Map<string, { url: string; expiresAt: number }>()

export async function signedUrls(
  bucket: string,
  paths: string[],
  orgId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<Record<string, string>> {
  const now = Date.now()
  const urls: Record<string, string> = {}
  const missing: string[] = []
  const margin = Math.min(MAX_SAFETY_MARGIN_MS, ttlSeconds * 100) // 10% of TTL

  const keyFor = (path: string) => `${orgId}/${bucket}/${path}`

  for (const path of paths) {
    const hit = store.get(keyFor(path))
    if (hit && hit.expiresAt - margin > now) urls[path] = hit.url
    else missing.push(path)
  }

  if (missing.length === 0) return urls

  const supabase = await createClient()
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrls(missing, ttlSeconds)

  ;(data ?? []).forEach((entry, i) => {
    if (!entry.signedUrl) return
    const path = missing[i]
    urls[path] = entry.signedUrl
    store.set(keyFor(path), {
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
