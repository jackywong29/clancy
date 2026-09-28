import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CrmConfig, WorkspaceRole } from '@/types/database'

// Workspace-level access control. Roles: viewer < editor < admin (labels are
// renameable per workspace in crm_config.role_labels — keys never change).
// Platform admins (Jacky) act as admin everywhere. The org boundary stays
// RLS-enforced; role checks within a workspace are enforced here, in the
// server actions/pages that perform reads and writes.

export interface Membership {
  userId: string
  orgId: string
  orgSlug: string
  role: WorkspaceRole
  department: string | null
  isPlatformAdmin: boolean
  crmConfig: CrmConfig
}

const RANK: Record<WorkspaceRole, number> = { viewer: 0, editor: 1, admin: 2 }

function normalizeRole(role: string, isPlatformAdmin: boolean): WorkspaceRole {
  if (isPlatformAdmin) return 'admin'
  if (role === 'admin' || role === 'owner') return 'admin'
  if (role === 'editor') return 'editor'
  return 'viewer'
}

// Loaded once per request. Every authenticated page used to pay for this three
// times over — the page, the Header, and a require* helper each ran their own
// getUser + profiles + organizations round-trip, and each hop is a call to
// Supabase from the other side of the world. Now: one auth call, one query.
//
// Returns state rather than redirecting so the Header can render for a
// logged-out or org-less visitor without bouncing them in a loop.
export const loadMembership = cache(
  async (): Promise<{ signedIn: boolean; membership: Membership | null }> => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { signedIn: false, membership: null }

    // The organization rides along on the profile via its foreign key, so the
    // workspace slug and crm_config arrive in the same round-trip.
    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'organization_id, role, department, is_platform_admin, organizations(slug, crm_config)'
      )
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.organization_id) return { signedIn: true, membership: null }

    const org = (profile.organizations ?? null) as {
      slug?: string
      crm_config?: CrmConfig
    } | null

    return {
      signedIn: true,
      membership: {
        userId: user.id,
        orgId: profile.organization_id,
        orgSlug: org?.slug ?? '',
        role: normalizeRole(profile.role ?? 'viewer', profile.is_platform_admin),
        department: profile.department ?? null,
        isPlatformAdmin: profile.is_platform_admin === true,
        crmConfig: (org?.crm_config ?? {}) as CrmConfig,
      },
    }
  }
)

export async function getMembership(): Promise<Membership> {
  const { signedIn, membership } = await loadMembership()
  if (!signedIn) redirect('/login')
  if (!membership) redirect('/no-access')
  return membership
}

export function hasRole(m: Membership, needed: WorkspaceRole): boolean {
  return RANK[m.role] >= RANK[needed]
}

// For mutations: editors and admins pass; viewers bounce back to the board.
export async function requireEditorOrg(): Promise<Membership> {
  const m = await getMembership()
  if (!hasRole(m, 'editor')) redirect('/pipeline?denied=1')
  return m
}

// For workspace administration (team, customize, own website).
export async function requireWorkspaceAdmin(): Promise<Membership> {
  const m = await getMembership()
  if (!hasRole(m, 'admin')) redirect('/pipeline?denied=1')
  return m
}

// Departments scope task visibility for non-admins: a member sees shared
// (department-less) tasks plus their own department's, and an admin sees
// everything. `null` means "no restriction".
//
// Returned as a PostgREST or() filter so the predicate is applied by the
// database on every task query, rather than by a post-fetch filter on one
// page — the invariant is that a task outside the caller's department is
// neither readable nor writable, not merely hidden.
export function taskDepartmentFilter(m: Membership): string | null {
  if (m.role === 'admin') return null
  if (!m.department) return 'department.is.null'
  // PostgREST treats . and : as reserved inside or(), so the value is quoted;
  // a stray double quote would close it early, so it is stripped.
  const value = m.department.replace(/"/g, '')
  return `department.is.null,department.eq."${value}"`
}

// The same rule against a single row, for mutations that resolve a task by id.
// One predicate, two call shapes — the display filter and the write check must
// never be able to disagree.
export function canAccessTaskDepartment(
  m: Membership,
  department: string | null
): boolean {
  return m.role === 'admin' || department === null || department === m.department
}

export function roleLabel(config: CrmConfig, role: WorkspaceRole): string {
  const defaults: Record<WorkspaceRole, string> = {
    viewer: 'Staff',
    editor: 'Head',
    admin: 'Admin',
  }
  return config.role_labels?.[role]?.trim() || defaults[role]
}
