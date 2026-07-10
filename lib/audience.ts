import type { SupabaseClient } from '@supabase/supabase-js'
import type { CrmConfig, WorkspaceRole } from '@/types/database'
import { roleLabel } from '@/lib/permissions'

export interface AudienceRecipient {
  name: string
  email: string
}

// Resolve a broadcast audience into named email recipients (RLS scopes to
// the caller's workspace). Audiences: 'all' | 'stage:<id>' → records;
// 'team' | 'role:<role>' | 'dept:<key>' → workspace members.
export async function resolveAudience(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  audience: string
): Promise<AudienceRecipient[]> {
  if (
    audience === 'team' ||
    audience.startsWith('role:') ||
    audience.startsWith('dept:')
  ) {
    let q = supabase
      .from('profiles')
      .select('id, full_name, email')
      .not('email', 'is', null)
      .neq('email', '')
    if (audience.startsWith('role:')) q = q.eq('role', audience.slice(5))
    if (audience.startsWith('dept:')) q = q.eq('department', audience.slice(5))
    const { data } = await q
    return ((data ?? []) as { full_name: string | null; email: string }[]).map(
      (p) => ({ name: p.full_name || p.email, email: p.email })
    )
  }
  let q = supabase
    .from('clients')
    .select('id, company_name, email')
    .not('email', 'is', null)
    .neq('email', '')
    .order('company_name')
  if (audience.startsWith('stage:')) q = q.eq('stage_id', audience.slice(6))
  const { data } = await q
  return ((data ?? []) as { company_name: string; email: string }[]).map(
    (c) => ({ name: c.company_name, email: c.email })
  )
}

export function audienceLabel(
  audience: string,
  config: CrmConfig,
  stageName: (id: string) => string | null,
  deptName: (key: string) => string | null
): string {
  const plural = config.record_plural || 'Records'
  if (audience === 'all') return `All ${plural.toLowerCase()} with an email`
  if (audience === 'team') return 'Whole team'
  if (audience.startsWith('stage:'))
    return `${plural}: ${stageName(audience.slice(6)) ?? 'stage'}`
  if (audience.startsWith('role:'))
    return `Team: ${roleLabel(config, audience.slice(5) as WorkspaceRole)}s`
  if (audience.startsWith('dept:'))
    return `Team: ${deptName(audience.slice(5)) ?? 'department'}`
  return audience
}
