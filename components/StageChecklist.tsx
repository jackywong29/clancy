import { updateTaskStatus, generateChecklistNow } from '@/lib/actions'
import { parseChecklist, checklistProgress } from '@/lib/checklist'
import type { PipelineStage, Task } from '@/types/database'

// The tick-off checklist for whichever stage a record is currently in.
// Shared by both detail pages — the client workspace record (/records/[id])
// and Clancy's own client page (/clients/[id]), which is the gap that made
// this feature invisible on Jacky's own workspace when it first shipped.

export function StageChecklist({
  recordId,
  stage,
  tasks,
  backTo,
}: {
  recordId: string
  stage: Pick<PipelineStage, 'id' | 'name' | 'checklist'> | undefined
  tasks: Task[]
  // Where "Add this stage's tasks" should return to. Defaults to the client
  // workspace record page; Clancy's own client page passes its own path.
  backTo?: string
}) {
  if (!stage) return null
  const items = parseChecklist(stage.checklist)
  if (items.length === 0 && tasks.length === 0) return null

  const progress = checklistProgress(tasks)
  const blockingTitles = new Set(
    items.filter((i) => i.blocking).map((i) => i.title)
  )
  // Items added to the stage after this record arrived.
  const missing = items.filter((i) => !tasks.some((t) => t.title === i.title))

  return (
    <div className="mb-6 rounded-xl border border-ash/60 bg-carbon p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{stage.name} checklist</p>
        {progress.total > 0 && (
          <span className="text-xs text-ivory/50">
            {progress.done}/{progress.total} done
          </span>
        )}
      </div>

      {tasks.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {tasks.map((task) => {
            const done = task.status === 'done'
            return (
              <form
                key={task.id}
                action={updateTaskStatus}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="task_id" value={task.id} />
                <input type="hidden" name="record_id" value={recordId} />
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

      {missing.length > 0 && (
        <form action={generateChecklistNow}>
          <input type="hidden" name="record_id" value={recordId} />
          {backTo && <input type="hidden" name="back_to" value={backTo} />}
          <p className="mb-2 text-xs text-ivory/60">
            {tasks.length === 0
              ? "This stage has a checklist, but this record arrived before it existed."
              : `${missing.length} newer checklist item${missing.length === 1 ? '' : 's'} on this stage isn't on this record yet.`}
          </p>
          <button
            type="submit"
            className="rounded-lg border border-ash px-3 py-1.5 text-sm hover:border-violet hover:text-violet"
          >
            Add this stage&apos;s tasks
          </button>
        </form>
      )}
    </div>
  )
}
