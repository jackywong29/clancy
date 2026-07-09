import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/actions'
import { Wordmark } from '@/components/Wordmark'
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher'
import type { Organization } from '@/types/database'

export async function Header() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('organization_id, is_platform_admin')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null }

  let orgs: Organization[] = []
  if (profile?.is_platform_admin) {
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .order('name')
    orgs = (data ?? []) as Organization[]
  }

  const { data: currentOrg } = profile?.organization_id
    ? await supabase
        .from('organizations')
        .select('slug')
        .eq('id', profile.organization_id)
        .maybeSingle()
    : { data: null }
  const isClancy = (currentOrg as { slug?: string } | null)?.slug === 'clancy'

  return (
    <header className="flex items-center justify-between border-b border-ash/60 bg-graphite px-6 py-3">
      <div className="flex items-center gap-8">
        <Link href="/pipeline">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/pipeline" className="font-medium">
            {isClancy ? 'Pipeline' : 'Board'}
          </Link>
          {isClancy ? (
            <Link href="/clients/new" className="text-ivory/60 hover:text-ivory">
              Add client
            </Link>
          ) : (
            <>
              <Link href="/records/new" className="text-ivory/60 hover:text-ivory">
                Add record
              </Link>
              <Link href="/crm" className="text-ivory/60 hover:text-ivory">
                Customize
              </Link>
            </>
          )}
          <Link href="/stages" className="text-ivory/60 hover:text-ivory">
            Stages
          </Link>
          {profile?.is_platform_admin && (
            <>
              <Link href="/sites" className="text-ivory/60 hover:text-ivory">
                Sites
              </Link>
              <Link href="/team" className="text-ivory/60 hover:text-ivory">
                Team
              </Link>
            </>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        {profile?.is_platform_admin && (
          <WorkspaceSwitcher
            orgs={orgs}
            currentId={profile.organization_id}
          />
        )}
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-ivory/60 hover:text-ivory"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  )
}
