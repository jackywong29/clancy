import { createClient } from '@/lib/supabase/server'
import { requireAdmin, updateProfileAccess } from '@/lib/actions'
import { Header } from '@/components/Header'
import type { Organization, Profile } from '@/types/database'

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const flags = await searchParams
  await requireAdmin()
  const supabase = await createClient()

  const [{ data: profiles }, { data: orgs }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true }),
    supabase.from('organizations').select('*').order('name'),
  ])

  const profileList = (profiles ?? []) as Profile[]
  const orgList = (orgs ?? []) as Organization[]
  const orgName = (id: string | null) =>
    orgList.find((o) => o.id === id)?.name ?? null

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-1 text-2xl font-medium">Team</h1>
        <p className="mb-6 text-sm text-graphite/60">
          Everyone with an account. New signups have no workspace until you
          grant one here.
        </p>
        {flags.saved && (
          <p className="mb-4 rounded-lg bg-violet/10 px-3 py-2 text-sm text-violet-deep">
            Access updated.
          </p>
        )}
        <div className="space-y-2">
          {profileList.map((profile) => (
            <div
              key={profile.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-mist/50 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {profile.email ?? profile.id}
                  {profile.is_platform_admin && (
                    <span className="ml-2 rounded bg-violet/10 px-1.5 py-0.5 text-xs font-normal text-violet-deep">
                      admin
                    </span>
                  )}
                </p>
                <p className="text-xs text-graphite/60">
                  {profile.full_name || '—'} · joined{' '}
                  {profile.created_at.slice(0, 10)} ·{' '}
                  {orgName(profile.organization_id) ?? (
                    <span className="text-red-600">no access</span>
                  )}
                </p>
              </div>
              <form action={updateProfileAccess} className="flex gap-2">
                <input type="hidden" name="profile_id" value={profile.id} />
                <select
                  name="organization_id"
                  defaultValue={profile.organization_id ?? ''}
                  className="rounded-lg border border-mist bg-porcelain px-2 py-1.5 text-sm"
                >
                  <option value="">No access</option>
                  {orgList.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-lg border border-mist px-3 py-1.5 text-sm hover:border-violet hover:text-violet-deep"
                >
                  Save
                </button>
              </form>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-graphite/50">
          Later, each client business becomes its own workspace here — you
          assign their staff to their workspace the same way.
        </p>
      </main>
    </div>
  )
}
