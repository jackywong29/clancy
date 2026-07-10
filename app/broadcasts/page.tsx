import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createBroadcast, deleteBroadcast } from '@/lib/actions'
import { getMembership, hasRole } from '@/lib/permissions'
import { recordLabel } from '@/lib/crm'
import { redirect } from 'next/navigation'
import { Header } from '@/components/Header'
import { ConfirmForm } from '@/components/ConfirmForm'
import type { Broadcast, PipelineStage } from '@/types/database'

const inputClass =
  'w-full rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet'

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
  const plural = recordLabel(m.crmConfig, true).toLowerCase()

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="mb-1 text-2xl font-medium">Broadcasts</h1>
        <p className="mb-6 text-sm text-ivory/60">
          Announcements, notices, and newsletters — emailed to the {plural}{' '}
          on your board who have an email address.
        </p>

        {flags.saved && (
          <p className="mb-4 rounded-lg bg-violet/10 px-3 py-2 text-sm text-violet">
            Marked as sent.
          </p>
        )}
        {flags.error && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            {flags.msg ?? "Couldn't save."}
          </p>
        )}

        <form
          action={createBroadcast}
          className="mb-8 space-y-3 rounded-xl border border-dashed border-ash bg-carbon/50 p-4"
        >
          <input
            name="subject"
            required
            placeholder="Subject"
            className={inputClass}
          />
          <textarea
            name="body"
            required
            rows={5}
            placeholder="Write your announcement…"
            className={inputClass}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select name="audience" defaultValue="all" className="rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet" aria-label="Audience">
              <option value="all">Everyone with an email</option>
              {stageList.map((s) => (
                <option key={s.id} value={`stage:${s.id}`}>
                  Only stage: {s.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-violet-deep px-5 py-2 text-sm font-medium text-white hover:bg-violet"
            >
              Prepare broadcast
            </button>
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
                <p className="text-xs text-ivory/60">
                  {b.recipient_count} recipient{b.recipient_count === 1 ? '' : 's'} ·{' '}
                  {b.created_at.slice(0, 10)}
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
