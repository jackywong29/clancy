import type { SupabaseClient } from '@supabase/supabase-js'
import type { CrmConfig, WorkspaceRole } from '@/types/database'
import { roleLabel } from '@/lib/permissions'
import { safeEmail } from '@/lib/safe-url'

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
  // 'custom' means the typed addresses are the whole audience — nothing to
  // look up. They're merged in by mergeRecipients().
  if (audience === 'custom') return []
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

// Accepts anything a human might paste: commas, semicolons, spaces, newlines,
// and "Name <a@b.com>" pairs copied out of a mail client.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseEmailList(raw: string): {
  valid: string[]
  invalid: string[]
} {
  const seen = new Set<string>()
  const valid: string[] = []
  const invalid: string[] = []

  const take = (token: string) => {
    if (!token) return
    if (!EMAIL_RE.test(token)) {
      invalid.push(token)
      return
    }
    const key = token.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    valid.push(token)
  }

  // Split on record separators first, then handle each entry. A "Name <addr>"
  // entry yields only the address — splitting on whitespace up front would
  // report the display name as an invalid address, which is exactly what a
  // paste out of Gmail or Outlook looks like.
  // Drop quoted display names before splitting — Outlook writes
  // `"Wong, Jacky" <a@b.com>`, and the comma inside the quotes would otherwise
  // split the entry and report `"Wong` as an invalid address.
  for (const chunk of raw.replace(/"[^"]*"/g, ' ').split(/[,;\n\r]+/)) {
    const entry = chunk.trim()
    if (!entry) continue
    const angled = entry.match(/<([^>]*)>/)
    if (angled) {
      take(angled[1].trim())
      continue
    }
    for (const token of entry.split(/\s+/)) take(token.trim())
  }
  return { valid, invalid }
}

// Audience recipients win over typed ones, so a person who is both a record
// and a typed address keeps their real name and is only emailed once.
//
// Every address must be one plain address (safeEmail). Record and profile
// emails are free text, and the mailer expands a value like
// "a@b.com, someone@else.test" into two envelope recipients — so a malformed
// stored email is dropped here, before the count, the review page or the send.
export function mergeRecipients(
  audienceRecipients: AudienceRecipient[],
  customEmails: string[]
): AudienceRecipient[] {
  const seen = new Set<string>()
  const merged: AudienceRecipient[] = []
  for (const r of audienceRecipients) {
    const email = safeEmail(r.email)
    if (!email) continue
    seen.add(email.toLowerCase())
    merged.push({ ...r, email })
  }
  for (const raw of customEmails) {
    const email = safeEmail(raw)
    if (!email) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push({ name: email, email })
  }
  return merged
}

export function audienceLabel(
  audience: string,
  config: CrmConfig,
  stageName: (id: string) => string | null,
  deptName: (key: string) => string | null,
  customCount = 0
): string {
  const plural = config.record_plural || 'Records'
  const extra = customCount > 0 ? ` + ${customCount} typed` : ''
  if (audience === 'custom')
    return customCount > 0
      ? `${customCount} typed address${customCount === 1 ? '' : 'es'}`
      : 'Typed addresses'
  if (audience === 'all')
    return `All ${plural.toLowerCase()} with an email${extra}`
  if (audience === 'team') return `Whole team${extra}`
  if (audience.startsWith('stage:'))
    return `${plural}: ${stageName(audience.slice(6)) ?? 'stage'}${extra}`
  if (audience.startsWith('role:'))
    return `Team: ${roleLabel(config, audience.slice(5) as WorkspaceRole)}s${extra}`
  if (audience.startsWith('dept:'))
    return `Team: ${deptName(audience.slice(5)) ?? 'department'}${extra}`
  return `${audience}${extra}`
}
