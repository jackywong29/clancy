import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/actions'
import { Wordmark } from '@/components/Wordmark'
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher'
import { NavLink } from '@/components/NavLink'
import type { Organization } from '@/types/database'

export async function Header() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('organization_id, is_platform_admin, role')
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
        .select('slug, crm_config')
        .eq('id', profile.organization_id)
        .maybeSingle()
    : { data: null }
  const org = currentOrg as
    | { slug?: string; crm_config?: { modules?: { tasks?: boolean; calendar?: boolean } } }
    | null
  const isClancy = org?.slug === 'clancy'
  const showTasks = isClancy || org?.crm_config?.modules?.tasks === true
  const showCalendar = isClancy || org?.crm_config?.modules?.calendar === true
  const isWorkspaceAdmin =
    profile?.is_platform_admin ||
    profile?.role === 'admin' ||
    profile?.role === 'owner'
  const isEditor = isWorkspaceAdmin || profile?.role === 'editor'

  let unread = 0
  let ownSiteSlug: string | null = null
  if (profile?.organization_id) {
    const [{ count }, { data: ownSite }] = await Promise.all([
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .eq('read', false),
      supabase
        .from('sites')
        .select('slug')
        .eq('organization_id', profile.organization_id)
        .limit(1)
        .maybeSingle(),
    ])
    unread = count ?? 0
    ownSiteSlug = (ownSite as { slug?: string } | null)?.slug ?? null
  }

  return (
    <header className="flex items-center justify-between border-b border-ash/60 bg-graphite px-6 py-3">
      <div className="flex items-center gap-8">
        <Link href="/pipeline">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-4 overflow-x-auto whitespace-nowrap text-sm">
          <NavLink href="/pipeline" label={isClancy ? 'Pipeline' : 'Board'} icon="board" />
          {isClancy ? (
            <NavLink href="/clients/new" label="Add client" icon="add" />
          ) : (
            <>
              {isEditor && <NavLink href="/records/new" label="Add" icon="add" />}
            </>
          )}
          {showTasks && <NavLink href="/tasks" label="Tasks" icon="tasks" />}
          {showCalendar && (
            <NavLink href="/calendar" label="Calendar" icon="calendar" />
          )}
          <NavLink href="/people" label="People" icon="people" />
          {isEditor && <NavLink href="/stages" label="Stages" icon="stages" />}
          {isEditor && (
            <NavLink href="/broadcasts" label="Broadcasts" icon="broadcasts" />
          )}
          {!isClancy && isWorkspaceAdmin && (
            <NavLink href="/crm" label="Customize" icon="customize" />
          )}
          {!isClancy && ownSiteSlug && (
            <NavLink href={`/s/${ownSiteSlug}`} label="View site" icon="view" external />
          )}
          {!isClancy && isWorkspaceAdmin && ownSiteSlug && (
            <NavLink
              href={`/sites/${ownSiteSlug}/edit`}
              label="Edit website"
              icon="edit"
            />
          )}
          {profile?.is_platform_admin && (
            <NavLink href="/sites" label="Sites" icon="sites" />
          )}
          {isWorkspaceAdmin && <NavLink href="/team" label="Team" icon="team" />}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        {profile?.organization_id && (
          <Link
            href="/notifications"
            className="relative text-sm text-ivory/60 hover:text-ivory"
            aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
          >
            Inbox
            {unread > 0 && (
              <span className="ml-1 rounded-full bg-violet px-1.5 py-0.5 text-xs font-medium text-white">
                {unread}
              </span>
            )}
          </Link>
        )}
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
