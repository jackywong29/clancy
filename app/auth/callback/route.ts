import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const providerError = searchParams.get('error_description') ?? searchParams.get('error')

  if (providerError) {
    return NextResponse.redirect(
      `${origin}/login?error=oauth&msg=${encodeURIComponent(providerError)}`
    )
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=oauth&msg=${encodeURIComponent(error.message)}`
      )
    }
  }

  return NextResponse.redirect(`${origin}/pipeline`)
}
