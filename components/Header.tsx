import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/actions'
import { Wordmark } from '@/components/Wordmark'
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher'
import { NavLink, type NavItem } from '@/components/NavLink'
import { MobileNav } from '@/components/MobileNav'
import { Inbox } from 'lucide-react'
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

  const navItems: NavItem[] = []
  navItems.push({
    href: '/pipeline',
    label: isClancy ? 'Pipeline' : 'Board',
    icon: 'board',
  })
  if (isClancy) {
    navItems.push({ href: '/clients/new', label: 'Add client', icon: 'add' })
  } else if (isEditor) {
    navItems.push({ href: '/records/new', label: 'Add', icon: 'add' })
  }
  if (showTasks) navItems.push({ href: '/tasks', label: 'Tasks', icon: 'tasks' })
  if (showCalendar)
    navItems.push({ href: '/calendar', label: 'Calendar', icon: 'calendar' })
  navItems.push({ href: '/people', label: 'People', icon: 'people' })
  if (isEditor)
    navItems.push({ href: '/workflow', label: 'Workflow', icon: 'stages' })
  if (isEditor)
    navItems.push({ href: '/broadcasts', label: 'Broadcasts', icon: 'broadcasts' })
  if (!isClancy && isWorkspaceAdmin)
    navItems.push({ href: '/crm', label: 'Customize', icon: 'customize' })
  if (!isClancy && ownSiteSlug)
    navItems.push({
      href: `/s/${ownSiteSlug}`,
      label: 'View site',
      icon: 'view',
      external: true,
    })
  if (!isClancy && isWorkspaceAdmin && ownSiteSlug)
    navItems.push({
      href: `/sites/${ownSiteSlug}/edit`,
      label: 'Edit website',
      icon: 'edit',
    })
  if (profile?.is_platform_admin)
    navItems.push({ href: '/sites', label: 'Sites', icon: 'sites' })
  if (isWorkspaceAdmin) navItems.push({ href: '/team', label: 'Team', icon: 'team' })

  const signOutButton = (
    <form action={signOut}>
      <button
        type="submit"
        className="text-sm text-ivory/60 hover:text-ivory"
      >
        Sign out
      </button>
    </form>
  )

  const switcher = profile?.is_platform_admin ? (
    <WorkspaceSwitcher orgs={orgs} currentId={profile.organization_id} />
  ) : null

  return (
    <header className="sticky top-0 z-40 border-b border-ash/60 bg-graphite">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:gap-6">
        <MobileNav
          items={navItems}
          footer={
            <>
              {switcher}
              {signOutButton}
            </>
          }
        />
        <Link href="/pipeline" className="shrink-0">
          <Wordmark />
        </Link>
        <nav className="hidden min-w-0 flex-1 items-center gap-4 overflow-x-auto whitespace-nowrap text-sm lg:flex">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-3 lg:gap-4">
          {profile?.organization_id && (
            <Link
              href="/notifications"
              className="relative flex items-center gap-1 text-sm text-ivory/60 hover:text-ivory"
              aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
            >
              <Inbox size={17} aria-hidden className="sm:hidden" />
              <span className="hidden sm:inline">Inbox</span>
              {unread > 0 && (
                <span className="rounded-full bg-violet px-1.5 py-0.5 text-xs font-medium text-white">
                  {unread}
                </span>
              )}
            </Link>
          )}
          <div className="hidden items-center gap-4 lg:flex">
            {switcher}
            {signOutButton}
          </div>
        </div>
      </div>
    </header>
  )
}
