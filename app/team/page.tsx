import { createClient } from '@/lib/supabase/server'
import {
  updateProfileAccess,
  updateMember,
  addInvite,
  removeInvite,
  saveTeamSettings,
} from '@/lib/actions'
import { getMembership, hasRole, roleLabel } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { Header } from '@/components/Header'
import { DepartmentListEditor } from '@/components/team/DepartmentListEditor'
import { CategoryListEditor } from '@/components/team/CategoryListEditor'
import type {
  Organization,
  OrgInvite,
  Profile,
  WorkspaceRole,
} from '@/types/database'

const inputClass =
  'rounded-lg border border-ash bg-graphite px-2 py-1.5 text-sm outline-none focus:border-violet'

const ROLES: WorkspaceRole[] = ['viewer', 'editor', 'admin']

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; msg?: string }>
}) {
  const flags = await searchParams
  const m = await getMembership()
  if (!hasRole(m, 'admin')) {
    redirect('/pipeline?denied=1')
  }
  const supabase = await createClient()

  const [{ data: members }, { data: invites }, { data: orgs }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true }),
      supabase
        .from('org_invites')
        .select('*')
        .eq('organization_id', m.orgId)
        .order('created_at', { ascending: true }),
      supabase.from('organizations').select('*').order('name'),
    ])

  const allProfiles = (members ?? []) as Profile[]
  const workspaceMembers = allProfiles.filter(
    (p) => p.organization_id === m.orgId
  )
  const inviteList = (invites ?? []) as OrgInvite[]
  const orgList = (orgs ?? []) as Organization[]
  const departments = m.crmConfig.departments ?? []
  const deptName = (key: string | null) =>
    departments.find((d) => d.key === key)?.name ?? null
  const orgName = (id: string | null) =>
    orgList.find((o) => o.id === id)?.name ?? null

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-1 text-2xl font-medium">Team</h1>
        <p className="mb-6 text-sm text-ivory/60">
          Who can see and do what in this workspace.{' '}
          {roleLabel(m.crmConfig, 'viewer')}s can only view,{' '}
          {roleLabel(m.crmConfig, 'editor')}s can edit,{' '}
          {roleLabel(m.crmConfig, 'admin')}s manage everything including this
          page.
        </p>
        {flags.saved && (
          <p className="mb-4 rounded-lg bg-violet/10 px-3 py-2 text-sm text-violet">
            Saved.
          </p>
        )}
        {flags.error && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            {flags.msg ?? "Couldn't save."}
          </p>
        )}

        <h2 className="mb-2 text-sm font-medium text-ivory/80">Members</h2>
        <div className="space-y-2">
          {workspaceMembers.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-ash/60 bg-carbon p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.email ?? member.id}
                  {member.is_platform_admin && (
                    <span className="ml-2 rounded bg-violet/10 px-1.5 py-0.5 text-xs font-normal text-violet">
                      Clancy admin
                    </span>
                  )}
                </p>
                <p className="text-xs text-ivory/60">
                  {member.full_name || '—'} ·{' '}
                  {roleLabel(m.crmConfig, (member.role as WorkspaceRole) ?? 'viewer')}
                  {deptName(member.department) ? ` · ${deptName(member.department)}` : ''}
                </p>
              </div>
              {member.is_platform_admin && !m.isPlatformAdmin ? (
                <p className="text-xs text-ivory/40">Managed by Clancy</p>
              ) : (
                <form action={updateMember} className="flex flex-wrap gap-2">
                  <input type="hidden" name="profile_id" value={member.id} />
                  <select
                    name="role"
                    defaultValue={
                      ROLES.includes(member.role as WorkspaceRole)
                        ? member.role
                        : 'admin'
                    }
                    className={inputClass}
                    aria-label="Role"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(m.crmConfig, r)}
                      </option>
                    ))}
                  </select>
                  <select
                    name="department"
                    defaultValue={member.department ?? ''}
                    className={inputClass}
                    aria-label="Department"
                  >
                    <option value="">No department</option>
                    {departments.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg border border-ash px-3 py-1.5 text-sm hover:border-violet hover:text-violet"
                  >
                    Save
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>

        <h2 className="mb-2 mt-8 text-sm font-medium text-ivory/80">
          Invite by email
        </h2>
        <p className="mb-2 text-xs text-ivory/50">
          When this email creates an account (or signs in with Google), they
          join this workspace automatically with the role you set — no
          approval step needed.
        </p>
        <div className="space-y-2">
          {inviteList.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-ash/60 bg-carbon/50 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{invite.email}</p>
                <p className="text-xs text-ivory/50">
                  {roleLabel(m.crmConfig, (invite.role as WorkspaceRole) ?? 'viewer')}
                  {deptName(invite.department)
                    ? ` · ${deptName(invite.department)}`
                    : ''}{' '}
                  · waiting for first sign-in
                </p>
              </div>
              <form action={removeInvite}>
                <input type="hidden" name="invite_id" value={invite.id} />
                <button
                  type="submit"
                  aria-label={`Remove invite for ${invite.email}`}
                  className="text-ivory/40 hover:text-red-400"
                >
                  ×
                </button>
              </form>
            </div>
          ))}
          <form
            action={addInvite}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-ash bg-carbon/50 p-3"
          >
            <input
              name="email"
              type="email"
              required
              placeholder="person@email.com"
              className={`${inputClass} flex-1`}
            />
            <select name="role" defaultValue="viewer" className={inputClass}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(m.crmConfig, r)}
                </option>
              ))}
            </select>
            <select name="department" defaultValue="" className={inputClass}>
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-violet-deep px-4 py-2 text-sm font-medium text-white hover:bg-violet"
            >
              Invite
            </button>
          </form>
        </div>

        <h2 className="mb-2 mt-8 text-sm font-medium text-ivory/80">
          Workspace settings
        </h2>
        <form
          action={saveTeamSettings}
          className="space-y-4 rounded-xl border border-ash/60 bg-carbon p-4"
        >
          <div>
            <p className="mb-2 text-sm font-medium">Role names</p>
            <p className="mb-2 text-xs text-ivory/50">
              Rename the three roles to match how this business talks — the
              permissions stay the same (view only · view + edit · full
              control).
            </p>
            <div className="grid grid-cols-3 gap-2">
              <input
                name="label_viewer"
                defaultValue={roleLabel(m.crmConfig, 'viewer')}
                className={inputClass}
                aria-label="Name for view-only role"
              />
              <input
                name="label_editor"
                defaultValue={roleLabel(m.crmConfig, 'editor')}
                className={inputClass}
                aria-label="Name for editor role"
              />
              <input
                name="label_admin"
                defaultValue={roleLabel(m.crmConfig, 'admin')}
                className={inputClass}
                aria-label="Name for admin role"
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Departments</p>
            <p className="mb-2 text-xs text-ivory/50">
              Members see tasks for their own department (plus shared,
              no-department tasks). {roleLabel(m.crmConfig, 'admin')}s see
              everything.
            </p>
            <DepartmentListEditor
              name="departments"
              initial={JSON.stringify(departments)}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Calendar categories</p>
            <p className="mb-2 text-xs text-ivory/50">
              Colour-coded event types — they become the calendar legend.
            </p>
            <CategoryListEditor
              name="calendar_categories"
              initial={JSON.stringify(m.crmConfig.calendar_categories ?? [])}
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-violet-deep px-5 py-2.5 text-sm font-medium text-white hover:bg-violet"
          >
            Save settings
          </button>
        </form>

        {m.isPlatformAdmin && (
          <>
            <h2 className="mb-2 mt-8 text-sm font-medium text-ivory/80">
              All accounts (Clancy platform)
            </h2>
            <div className="space-y-2">
              {allProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-ash/60 bg-carbon p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{profile.email ?? profile.id}</p>
                    <p className="text-xs text-ivory/60">
                      {orgName(profile.organization_id) ?? (
                        <span className="text-red-400">no access</span>
                      )}
                    </p>
                  </div>
                  <form action={updateProfileAccess} className="flex gap-2">
                    <input type="hidden" name="profile_id" value={profile.id} />
                    <select
                      name="organization_id"
                      defaultValue={profile.organization_id ?? ''}
                      className={inputClass}
                      aria-label="Workspace"
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
                      className="rounded-lg border border-ash px-3 py-1.5 text-sm hover:border-violet hover:text-violet"
                    >
                      Save
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
