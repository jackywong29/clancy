import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  updateRecord,
  deleteRecord,
  requireOrg,
  updateTaskStatus,
  generateChecklistNow,
} from '@/lib/actions'
import { Header } from '@/components/Header'
import { RecordFields } from '@/components/RecordFields'
import { ConfirmForm } from '@/components/ConfirmForm'
import { recordLabel } from '@/lib/crm'
import { parseChecklist, checklistProgress } from '@/lib/checklist'
import type {
  Client,
  CrmConfig,
  Organization,
  PipelineStage,
  Task,
} from '@/types/database'

export default async function RecordDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; error?: string; msg?: string }>
}) {
  const { id } = await params
  const flags = await searchParams
  const orgId = await requireOrg()
  const supabase = await createClient()

  const [{ data: orgRow }, { data: recordRow }, { data: stages }] =
    await Promise.all([
      supabase.from('organizations').select('*').eq('id', orgId).maybeSingle(),
      supabase.from('clients').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('pipeline_stages')
        .select('*')
        .order('position', { ascending: true }),
    ])

  const org = orgRow as Organization | null
  if (org?.slug === 'clancy') redirect(`/clients/${id}`)
  if (!recordRow) notFound()

  const record = recordRow as Client
  const config = (org?.crm_config ?? {}) as CrmConfig

  // Checklist for the stage this record is currently sitting in.
  const stageList = (stages ?? []) as PipelineStage[]
  const currentStage = stageList.find((s) => s.id === record.stage_id)
  const stageChecklist = currentStage ? parseChecklist(currentStage.checklist) : []

  const { data: stageTaskRows } = currentStage
    ? await supabase
        .from('tasks')
        .select('*')
        .eq('client_id', record.id)
        .eq('origin_stage_id', currentStage.id)
        .order('created_at', { ascending: true })
    : { data: [] }

  const stageTasks = (stageTaskRows ?? []) as Task[]
  const progress = checklistProgress(stageTasks)
  const blockingTitles = new Set(
    stageChecklist.filter((i) => i.blocking).map((i) => i.title)
  )

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-medium">{record.company_name}</h1>
          <Link href="/pipeline" className="text-sm text-ivory/60 hover:text-ivory">
            ← Board
          </Link>
        </div>

        {flags.saved && (
          <p className="mb-4 rounded-lg bg-violet/10 px-3 py-2 text-sm text-violet">
            Saved.
          </p>
        )}
        {flags.error && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            Couldn&apos;t save{flags.msg ? `: ${flags.msg}` : '.'}
          </p>
        )}

        {currentStage && (stageChecklist.length > 0 || stageTasks.length > 0) && (
          <div className="mb-6 rounded-xl border border-ash/60 bg-carbon p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">
                {currentStage.name} checklist
              </p>
              {progress.total > 0 && (
                <span className="text-xs text-ivory/50">
                  {progress.done}/{progress.total} done
                </span>
              )}
            </div>

            {stageTasks.length === 0 ? (
              <form action={generateChecklistNow}>
                <input type="hidden" name="record_id" value={record.id} />
                <p className="mb-2 text-xs text-ivory/60">
                  This stage has a checklist, but this record arrived before it
                  existed.
                </p>
                <button
                  type="submit"
                  className="rounded-lg border border-ash px-3 py-1.5 text-sm hover:border-violet hover:text-violet"
                >
                  Generate checklist
                </button>
              </form>
            ) : (
              <div className="space-y-1.5">
                {stageTasks.map((task) => {
                  const done = task.status === 'done'
                  return (
                    <form
                      key={task.id}
                      action={updateTaskStatus}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="task_id" value={task.id} />
                      <input type="hidden" name="record_id" value={record.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={done ? 'pending' : 'done'}
                      />
                      <button
                        type="submit"
                        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                          done
                            ? 'border-violet bg-violet text-white'
                            : 'border-ash hover:border-violet'
                        }`}
                      >
                        {done ? '✓' : ''}
                      </button>
                      <span
                        className={`min-w-0 flex-1 break-words text-sm ${
                          done ? 'text-ivory/40 line-through' : 'text-ivory/80'
                        }`}
                      >
                        {task.title}
                      </span>
                      {blockingTitles.has(task.title) && !done && (
                        <span className="shrink-0 rounded bg-amber-950/40 px-1.5 py-0.5 text-xs text-amber-300">
                          blocks
                        </span>
                      )}
                      {task.due_date && !done && (
                        <span className="shrink-0 text-xs text-ivory/40">
                          {task.due_date.slice(5)}
                        </span>
                      )}
                    </form>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <form action={updateRecord} className="space-y-4">
          <input type="hidden" name="record_id" value={record.id} />
          <RecordFields
            config={config}
            stages={(stages ?? []) as PipelineStage[]}
            record={record}
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-violet-deep px-5 py-2.5 text-sm font-medium text-white hover:bg-violet sm:w-auto"
          >
            Save changes
          </button>
        </form>

        <div className="mt-10 border-t border-ash/60 pt-6">
          <ConfirmForm
            action={deleteRecord}
            message={`Delete ${record.company_name}? This can't be undone.`}
          >
            <input type="hidden" name="record_id" value={record.id} />
            <button
              type="submit"
              className="w-full rounded-lg border border-red-950 px-4 py-2 text-sm text-red-400 hover:border-red-400 sm:w-auto"
            >
              Delete {recordLabel(config).toLowerCase()}
            </button>
          </ConfirmForm>
        </div>
      </main>
    </div>
  )
}
