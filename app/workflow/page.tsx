import { createClient } from '@/lib/supabase/server'
import { addStage, deleteStage, saveWorkflow } from '@/lib/actions'
import { getMembership, hasRole } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { Header } from '@/components/Header'
import { ConfirmForm } from '@/components/ConfirmForm'
import { SubmitButton } from '@/components/SubmitButton'
import { WorkflowEditor, type StageDraft } from '@/components/WorkflowEditor'
import { parseChecklist } from '@/lib/checklist'
import { recordLabel } from '@/lib/crm'
import type { Client, PipelineStage } from '@/types/database'

// The pipeline and its process on one screen. Replaces /stages, where the
// checklist hid behind a disclosure triangle next to a rival Save button.
export default async function WorkflowPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; msg?: string; count?: string }>
}) {
  const flags = await searchParams
  const m = await getMembership()
  if (!hasRole(m, 'admin')) redirect('/pipeline?denied=1')
  const supabase = await createClient()

  const [{ data: stages }, { data: clients }] = await Promise.all([
    supabase
      .from('pipeline_stages')
      .select('*')
      .order('position', { ascending: true }),
    supabase.from('clients').select('id, stage_id'),
  ])

  const stageList = (stages ?? []) as PipelineStage[]
  const clientList = (clients ?? []) as Pick<Client, 'id' | 'stage_id'>[]
  const plural = recordLabel(m.crmConfig, true)

  const drafts: StageDraft[] = stageList.map((s) => ({
    id: s.id,
    name: s.name,
    position: s.position,
    checklist: parseChecklist(s.checklist),
    inUse: clientList.filter((c) => c.stage_id === s.id).length,
  }))

  const totalTasks = drafts.reduce((n, s) => n + s.checklist.length, 0)

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="mb-1 text-2xl font-medium">Workflow</h1>
        <p className="mb-6 max-w-2xl text-sm text-ivory/60">
          Your pipeline and the work that happens at each step. Tasks listed
          under a stage appear automatically on a record the moment it lands
          there. Arrows reorder the pipeline. One save covers everything.
        </p>

        {flags.saved && (
          <p className="mb-4 rounded-lg bg-violet/10 px-3 py-2 text-sm text-violet">
            Workflow saved.
          </p>
        )}
        {flags.error === 'in-use' && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            That stage still has {flags.count ?? 'some'} record
            {flags.count === '1' ? '' : 's'} in it — move them out first.
          </p>
        )}
        {flags.error && flags.error !== 'in-use' && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            {flags.msg ?? "Couldn't save."}
          </p>
        )}

        {stageList.length === 0 ? (
          <p className="mb-6 text-sm text-ivory/60">
            No stages yet — add the first one below.
          </p>
        ) : (
          <form action={saveWorkflow}>
            <WorkflowEditor
              name="workflow"
              initial={drafts}
              departments={m.crmConfig.departments ?? []}
              recordPlural={plural}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <SubmitButton
                pendingText="Saving…"
                className="rounded-lg bg-violet-deep px-5 py-2.5 text-sm font-medium text-white hover:bg-violet"
              >
                Save workflow
              </SubmitButton>
              <span className="text-xs text-ivory/50">
                {stageList.length} stage{stageList.length === 1 ? '' : 's'} ·{' '}
                {totalTasks} task{totalTasks === 1 ? '' : 's'} across the
                pipeline
              </span>
            </div>
          </form>
        )}

        <div className="mt-10 border-t border-ash/60 pt-6">
          <h2 className="mb-2 text-sm font-medium text-ivory/80">
            Add a stage
          </h2>
          <form
            action={addStage}
            className="flex flex-col gap-2 rounded-xl border border-dashed border-ash bg-carbon/50 p-3 sm:flex-row sm:items-center"
          >
            <input
              name="name"
              required
              placeholder="New stage name"
              className="min-w-0 rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet sm:flex-1"
            />
            <button
              type="submit"
              className="rounded-lg bg-violet-deep px-4 py-2 text-sm font-medium text-white hover:bg-violet"
            >
              Add stage
            </button>
          </form>

          {stageList.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-sm font-medium text-ivory/80">
                Delete a stage
              </h2>
              <p className="mb-2 text-xs text-ivory/50">
                A stage holding records can&apos;t be deleted — move them out
                first.
              </p>
              <div className="flex flex-wrap gap-2">
                {drafts.map((stage) => (
                  <ConfirmForm
                    key={stage.id}
                    action={deleteStage}
                    message={`Delete stage "${stage.name}"? This can't be undone.`}
                  >
                    <input type="hidden" name="stage_id" value={stage.id} />
                    <button
                      type="submit"
                      disabled={stage.inUse > 0}
                      className="rounded-lg border border-red-950 px-3 py-1.5 text-sm text-red-400 disabled:opacity-30 hover:enabled:border-red-400"
                    >
                      {stage.name}
                      {stage.inUse > 0 && ` (${stage.inUse})`}
                    </button>
                  </ConfirmForm>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
