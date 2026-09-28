import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Every redirect here is path-only. The absolute origin available at this
// point comes from the request URL, which Next builds from the Host header —
// attacker-controlled input, and this route runs immediately after a session
// is established. A relative Location is resolved by the browser against the
// address it actually asked for, so the destination can never be moved to
// another host.
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 302, headers: { Location: path } })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const providerError = searchParams.get('error_description') ?? searchParams.get('error')

  if (providerError) {
    return redirectTo(
      `/login?error=oauth&msg=${encodeURIComponent(providerError)}`
    )
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return redirectTo(
        `/login?error=oauth&msg=${encodeURIComponent(error.message)}`
      )
    }
  }

  return redirectTo('/home')
}
