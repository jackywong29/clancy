'use client'

import { switchWorkspace } from '@/lib/actions'
import type { Organization } from '@/types/database'

export function WorkspaceSwitcher({
  orgs,
  currentId,
}: {
  orgs: Organization[]
  currentId: string | null
}) {
  if (orgs.length < 2) return null

  return (
    <form action={switchWorkspace}>
      <select
        name="organization_id"
        defaultValue={currentId ?? ''}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-ash bg-graphite px-2 py-1.5 text-xs text-ivory"
        aria-label="Switch workspace"
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </form>
  )
}
