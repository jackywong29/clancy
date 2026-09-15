'use client'

import { useFormStatus } from 'react-dom'
import { switchWorkspace } from '@/lib/actions'
import type { Organization } from '@/types/database'

// Switching workspace is a server action, and server actions do NOT trigger
// the route loader — nothing in the UI moved between the click and the
// redirect landing, which reads as "the dropdown is broken". The select is
// disabled and labelled while the switch is in flight, both so there's
// immediate feedback and so a second change can't race the first.
function Select({
  orgs,
  currentId,
}: {
  orgs: Organization[]
  currentId: string | null
}) {
  const { pending } = useFormStatus()

  return (
    <div className="flex items-center gap-2">
      <select
        name="organization_id"
        defaultValue={currentId ?? ''}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        disabled={pending}
        className="rounded-lg border border-ash bg-graphite px-2 py-1.5 text-xs text-ivory disabled:opacity-50"
        aria-label="Switch workspace"
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      {pending && (
        <span className="text-xs text-ivory/50" role="status">
          Switching…
        </span>
      )}
    </div>
  )
}

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
      <Select orgs={orgs} currentId={currentId} />
    </form>
  )
}
