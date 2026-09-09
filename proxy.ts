import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Runs on every request that isn't a static asset — including RSC payloads and
// link prefetches. `getUser()` is a network call to Supabase Auth, so doing it
// unconditionally put an intercontinental round-trip in front of every click.
//
// It is only genuinely needed to refresh a session that is about to expire.
// Authorisation does NOT depend on it: every protected page and server action
// goes through getMembership()/require*, which validates the user itself. So
// when the session cookie says the access token is still comfortably valid,
// this hands the request straight on.
const REFRESH_WINDOW_SECONDS = 120

// Supabase stores the session as `sb-<ref>-auth-token`, chunked into `.0`,
// `.1`… when large. Value is either base64url JSON (current) or URL-encoded
// JSON (older). Anything unexpected returns null, which falls back to the
// full network validation below — never to "assume signed in".
export function sessionExpiry(request: NextRequest): number | null {
  const chunks = request.cookies
    .getAll()
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
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

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const { pathname } = request.nextUrl
  const expiresAt = sessionExpiry(request)

  // The cookie is unverified, so this can only be used to SKIP work, never to
  // decide someone is signed in. /login is excluded deliberately: bouncing to
  // /pipeline on an unexpired-but-invalid cookie loops forever, because the
  // page then redirects back to /login. /login always gets the real check.
  if (
    expiresAt !== null &&
    expiresAt - Date.now() / 1000 > REFRESH_WINDOW_SECONDS &&
    pathname !== '/login'
  ) {
    // Token has time left and needs no refresh: no network, no wait. Pages and
    // server actions still validate the user, so a forged cookie gains nothing.
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (
    !user &&
    pathname !== '/' &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/signup') &&
    !pathname.startsWith('/auth') &&
    !pathname.startsWith('/s/') &&
    !pathname.startsWith('/i/')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/pipeline'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
