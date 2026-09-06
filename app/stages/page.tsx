import { createClient } from '@/lib/supabase/server'
import {
  addStage,
  updateStage,
  deleteStage,
  saveStageChecklist,
} from '@/lib/actions'
import { getMembership, hasRole } from '@/lib/permissions'
import { Header } from '@/components/Header'
import { ConfirmForm } from '@/components/ConfirmForm'
import { ChecklistEditor } from '@/components/ChecklistEditor'
import { parseChecklist } from '@/lib/checklist'
import type { Client, PipelineStage } from '@/types/database'

const inputClass =
  'rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet'

export default async function StagesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; count?: string }>
}) {
  const flags = await searchParams
  const m = await getMembership()
  const supabase = await createClient()
  const canEditChecklist = hasRole(m, 'admin')
  const departments = m.crmConfig.departments ?? []

  const [{ data: stages }, { data: clients }] = await Promise.all([
    supabase
      .from('pipeline_stages')
      .select('*')
      .order('position', { ascending: true }),
    supabase.from('clients').select('id, stage_id'),
  ])

  const stageList = (stages ?? []) as PipelineStage[]
  const clientList = (clients ?? []) as Pick<Client, 'id' | 'stage_id'>[]
  const countFor = (stageId: string) =>
    clientList.filter((c) => c.stage_id === stageId).length

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="mb-1 text-2xl font-medium">Pipeline stages</h1>
        <p className="mb-6 text-sm text-ivory/60">
          Rename, reorder (lower number = further left), add, or delete
          stages. A stage with clients in it can&apos;t be deleted — move them
          out first.
        </p>
        {flags.saved && (
          <p className="mb-4 rounded-lg bg-violet/10 px-3 py-2 text-sm text-violet">
            Saved.
          </p>
        )}
        {flags.error === 'in-use' && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            That stage still has {flags.count ?? 'some'} client
            {flags.count === '1' ? '' : 's'} in it — move them to another
            stage first.
          </p>
        )}
        <div className="space-y-2">
          {stageList.map((stage) => {
            const inUse = countFor(stage.id)
            const checklist = parseChecklist(stage.checklist)
            return (
              <div
                key={stage.id}
                className="rounded-xl border border-ash/60 bg-carbon p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <form
                  action={updateStage}
                  className="flex flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center"
                >
                  <input type="hidden" name="stage_id" value={stage.id} />
                  <input
                    name="position"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue={stage.position}
                    className={`${inputClass} w-20`}
                    aria-label="Position"
                  />
                  <input
                    name="name"
                    required
                    defaultValue={stage.name}
                    className={`${inputClass} min-w-0 sm:flex-1`}
                    aria-label="Stage name"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-ivory/50">
                      {inUse} client{inUse === 1 ? '' : 's'}
                    </span>
                    <button
                      type="submit"
                      className="rounded-lg border border-ash px-3 py-2 text-sm hover:border-violet hover:text-violet sm:py-1.5"
                    >
                      Save
                    </button>
                  </div>
                </form>
                <ConfirmForm
                  action={deleteStage}
                  message={`Delete stage "${stage.name}"? This can't be undone.`}
                >
                  <input type="hidden" name="stage_id" value={stage.id} />
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-red-950 px-3 py-2 text-sm text-red-400 hover:border-red-400 sm:w-auto sm:py-1.5"
                  >
                    Delete
                  </button>
                </ConfirmForm>
                </div>

                {canEditChecklist && (
                  <details className="mt-3 border-t border-ash/40 pt-3" open={checklist.length > 0}>
                    <summary className="cursor-pointer text-xs text-ivory/60 hover:text-violet">
                      Checklist
                      {checklist.length > 0
                        ? ` — ${checklist.length} task${checklist.length === 1 ? '' : 's'}`
                        : ' — none yet'}
                    </summary>
                    <p className="mb-2 mt-2 text-xs text-ivory/50">
                      These appear as tasks on a record the moment it lands in
                      this stage. Existing records aren&apos;t touched — use
                      &ldquo;Generate checklist&rdquo; on a record to pull them
                      in.
                    </p>
                    <form action={saveStageChecklist} className="space-y-2">
                      <input type="hidden" name="stage_id" value={stage.id} />
                      <ChecklistEditor
                        name="checklist"
                        initial={JSON.stringify(checklist)}
                        departments={departments}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-ash px-3 py-1.5 text-sm hover:border-violet hover:text-violet"
                      >
                        Save checklist
                      </button>
                    </form>
                  </details>
                )}
              </div>
            )
          })}
        </div>
        <form
          action={addStage}
          className="mt-6 flex flex-col gap-2 rounded-xl border border-dashed border-ash bg-carbon/50 p-3 sm:flex-row sm:items-center"
        >
          <input
            name="name"
            required
            placeholder="New stage name"
            className={`${inputClass} min-w-0 sm:flex-1`}
          />
          <button
            type="submit"
            className="rounded-lg bg-violet-deep px-4 py-2 text-sm font-medium text-white hover:bg-violet"
          >
            Add stage
          </button>
        </form>
      </main>
    </div>
  )
}
