import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/actions'
import { Wordmark } from '@/components/Wordmark'

export async function Header() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null }

  return (
    <header className="flex items-center justify-between border-b border-ash/60 bg-graphite px-6 py-3">
      <div className="flex items-center gap-8">
        <Link href="/pipeline">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/pipeline" className="font-medium">
            Pipeline
          </Link>
          <Link
            href="/clients/new"
            className="text-ivory/60 hover:text-ivory"
          >
            Add client
          </Link>
          <Link href="/stages" className="text-ivory/60 hover:text-ivory">
            Stages
          </Link>
          {profile?.is_platform_admin && (
            <Link href="/team" className="text-ivory/60 hover:text-ivory">
              Team
            </Link>
          )}
        </nav>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="text-sm text-ivory/60 hover:text-ivory"
        >
          Sign out
        </button>
      </form>
    </header>
  )
}
