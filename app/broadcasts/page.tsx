import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createBroadcast, deleteBroadcast } from '@/lib/actions'
import { getMembership, hasRole, roleLabel } from '@/lib/permissions'
import { audienceLabel } from '@/lib/audience'
import { isEmailConfigured } from '@/lib/email'
import { recordLabel } from '@/lib/crm'
import { redirect } from 'next/navigation'
import { Header } from '@/components/Header'
import { ConfirmForm } from '@/components/ConfirmForm'
import { AttachmentUpload } from '@/components/AttachmentUpload'
import { hasSignature } from '@/lib/broadcast-email'
import { Paperclip } from 'lucide-react'
import type { Broadcast, PipelineStage, WorkspaceRole } from '@/types/database'

const ROLES: WorkspaceRole[] = ['viewer', 'editor', 'admin']

export default async function BroadcastsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; msg?: string }>
}) {
  const flags = await searchParams
  const m = await getMembership()
  if (!hasRole(m, 'editor')) redirect('/pipeline?denied=1')
  const supabase = await createClient()

  const [{ data: broadcasts }, { data: stages }] = await Promise.all([
    supabase
      .from('broadcasts')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('pipeline_stages')
      .select('*')
      .order('position', { ascending: true }),
  ])

  const list = (broadcasts ?? []) as Broadcast[]
  const stageList = (stages ?? []) as PipelineStage[]
  const departments = m.crmConfig.departments ?? []
  const plural = recordLabel(m.crmConfig, true)
  const stageName = (id: string) =>
    stageList.find((s) => s.id === id)?.name ?? null
  const deptName = (key: string) =>
    departments.find((d) => d.key === key)?.name ?? null
  const automated = isEmailConfigured()
  const signed = hasSignature(m.crmConfig.signature)
  const isAdmin = hasRole(m, 'admin')

  const rowClass = 'flex items-center gap-3 border-b border-ash/50 px-4 py-3'
  const fieldClass =
    'flex-1 bg-transparent text-sm outline-none placeholder:text-ivory/40'

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="mb-1 text-2xl font-medium">Broadcasts</h1>
        <p className="mb-6 text-sm text-ivory/60">
          Announcements, notices, and newsletters — to your {plural.toLowerCase()}{' '}
          or your team.{' '}
          {automated
            ? 'Sending is automated from the Clancy email.'
            : 'Sends via your mail app until automated email is configured.'}
        </p>

        {flags.saved && (
          <p className="mb-4 rounded-lg bg-violet/10 px-3 py-2 text-sm text-violet">
            Sent.
          </p>
        )}
        {flags.error && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            {flags.msg ?? "Couldn't save."}
          </p>
        )}

        <form
          action={createBroadcast}
          className="mb-8 overflow-hidden rounded-xl border border-ash/60 bg-carbon"
        >
          <div className={rowClass}>
            <span className="w-16 shrink-0 text-sm text-ivory/50">To</span>
            <select
              name="audience"
              defaultValue="all"
              className="flex-1 bg-transparent text-sm outline-none"
              aria-label="Audience"
            >
              <option value="custom">Just the addresses I type below</option>
              <optgroup label={plural}>
                <option value="all">All {plural.toLowerCase()} with an email</option>
                {stageList.map((s) => (
                  <option key={s.id} value={`stage:${s.id}`}>
                    Only stage: {s.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Team">
                <option value="team">Whole team</option>
                {ROLES.map((r) => (
                  <option key={r} value={`role:${r}`}>
                    Only {roleLabel(m.crmConfig, r)}s
                  </option>
                ))}
                {departments.map((d) => (
                  <option key={d.key} value={`dept:${d.key}`}>
                    Only department: {d.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="flex items-start gap-3 border-b border-ash/50 px-4 py-3">
            <span className="w-16 shrink-0 pt-1 text-sm text-ivory/50">
              Also to
            </span>
            <div className="flex-1">
              <textarea
                name="custom_recipients"
                rows={2}
                placeholder="Type or paste email addresses — commas, spaces or new lines"
                className="w-full bg-transparent text-sm leading-relaxed outline-none placeholder:text-ivory/40"
              />
              <p className="text-xs text-ivory/40">
                Added on top of whoever&apos;s picked above. Anyone in both
                lists is only emailed once.
              </p>
            </div>
          </div>
          <div className={rowClass}>
            <span className="w-16 shrink-0 text-sm text-ivory/50">Subject</span>
            <input
              name="subject"
              required
              placeholder="What's this about?"
              className={fieldClass}
            />
          </div>
          <div className="px-4 py-3">
            <textarea
              name="body"
              required
              rows={6}
              placeholder="Write your message…"
              className="w-full bg-transparent text-sm leading-relaxed outline-none placeholder:text-ivory/40"
            />
          </div>
          <div className="border-t border-ash/50 px-4 py-3">
            <AttachmentUpload name="attachments" orgId={m.orgId} />
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-ash/50 px-4 py-3">
            <button
              type="submit"
              className="rounded-lg bg-violet-deep px-5 py-2 text-sm font-medium text-white hover:bg-violet"
            >
              Review & send →
            </button>
            <p className="text-xs text-ivory/50">
              {signed ? (
                <>Your sign-off is added automatically.</>
              ) : (
                <>No sign-off set — emails go out without a signature.</>
              )}{' '}
              {isAdmin && (
                <Link href="/team" className="text-violet hover:underline">
                  {signed ? 'Edit it' : 'Set one up'}
                </Link>
              )}
            </p>
          </div>
        </form>

        <div className="space-y-2">
          {list.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-ash/60 bg-carbon p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {b.subject}
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-xs font-normal ${
                      b.status === 'sent'
                        ? 'bg-violet/10 text-violet'
                        : 'bg-ash/40 text-ivory/50'
                    }`}
                  >
                    {b.status}
                  </span>
                </p>
                <p className="flex flex-wrap items-center gap-x-1 text-xs text-ivory/60">
                  <span>
                    {audienceLabel(
                      b.audience,
                      m.crmConfig,
                      stageName,
                      deptName,
                      b.custom_recipients?.length ?? 0
                    )}{' '}
                    ·{' '}
                    {b.recipient_count} recipient
                    {b.recipient_count === 1 ? '' : 's'} ·{' '}
                    {b.created_at.slice(0, 10)}
                  </span>
                  {(b.attachments?.length ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      · <Paperclip className="h-3 w-3" aria-hidden />
                      {b.attachments.length}
                    </span>
                  )}
                </p>
              </div>
              <Link
                href={`/broadcasts/${b.id}`}
                className="rounded-lg border border-ash px-3 py-1.5 text-sm hover:border-violet hover:text-violet"
              >
                Open
              </Link>
              <ConfirmForm
                action={deleteBroadcast}
                message={`Delete broadcast "${b.subject}"?`}
              >
                <input type="hidden" name="broadcast_id" value={b.id} />
                <button
                  type="submit"
                  aria-label={`Delete ${b.subject}`}
                  className="text-ivory/40 hover:text-red-400"
                >
                  ×
                </button>
              </ConfirmForm>
            </div>
          ))}
          {list.length === 0 && (
            <p className="rounded-xl border border-dashed border-ash bg-carbon/50 p-6 text-center text-sm text-ivory/60">
              No broadcasts yet — write the first one above.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
