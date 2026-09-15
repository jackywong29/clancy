// Reading the Supabase session cookie WITHOUT a network call.
//
// Two callers, one parser: the proxy uses it to decide whether a session even
// needs refreshing, and the public landing page uses it to decide whether to
// offer "Sign in" or a link into the app.
//
// This is never an authorisation check. The cookie is unverified, so a value
// here may only be used to skip work or pick a label — every protected page
// and server action still validates the user against Supabase.
//
// Shape: `sb-<ref>-auth-token`, chunked into `.0`, `.1`… when large. The value
// is either base64url JSON (current) or URL-encoded JSON (older). Anything
// unexpected returns null, which must always mean "fall back to the real
// check", never "assume signed in".

const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/

export function sessionExpiryFrom(
  cookies: { name: string; value: string }[]
): number | null {
  const chunks = cookies
    .filter((c) => AUTH_COOKIE.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
  if (chunks.length === 0) return null

  const raw = chunks.map((c) => c.value).join('')
  try {
    const json = raw.startsWith('base64-')
      ? Buffer.from(raw.slice('base64-'.length), 'base64url').toString('utf8')
      : decodeURIComponent(raw)
    const expiresAt: unknown = JSON.parse(json)?.expires_at
    return typeof expiresAt === 'number' ? expiresAt : null
  } catch {
    return null
  }
}

// True when a cookie claims a session that hasn't expired. Cosmetic use only.
export function looksSignedIn(
  cookies: { name: string; value: string }[]
): boolean {
  const expiresAt = sessionExpiryFrom(cookies)
  return expiresAt !== null && expiresAt > Date.now() / 1000
}
