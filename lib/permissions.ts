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

export async function getMembership(): Promise<Membership> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role, department, is_platform_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.organization_id) redirect('/no-access')

  const { data: org } = await supabase
    .from('organizations')
    .select('slug, crm_config')
    .eq('id', profile.organization_id)
    .maybeSingle()

  return {
    userId: user.id,
    orgId: profile.organization_id,
    orgSlug: (org?.slug as string) ?? '',
    role: normalizeRole(profile.role ?? 'viewer', profile.is_platform_admin),
    department: profile.department ?? null,
    isPlatformAdmin: profile.is_platform_admin === true,
    crmConfig: ((org?.crm_config as CrmConfig) ?? {}) as CrmConfig,
  }
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

export function roleLabel(config: CrmConfig, role: WorkspaceRole): string {
  const defaults: Record<WorkspaceRole, string> = {
    viewer: 'Staff',
    editor: 'Head',
    admin: 'Admin',
  }
  return config.role_labels?.[role]?.trim() || defaults[role]
}
