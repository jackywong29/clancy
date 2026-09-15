import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { sessionExpiryFrom } from '@/lib/session-cookie'

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

// Parsing lives in lib/session-cookie so the landing page can read the same
// cookie without duplicating the format handling.

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const { pathname } = request.nextUrl
  const expiresAt = sessionExpiryFrom(request.cookies.getAll())

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
