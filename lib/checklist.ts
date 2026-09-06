import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChecklistItem, PipelineStage, Task } from '@/types/database'
import { addDays, klToday } from '@/lib/dates'

// Stage checklists — the SOP layer.
//
// When a record lands in a stage, that stage's checklist becomes real tasks
// against the record. Generation is idempotent: tasks carry origin_stage_id,
// so moving a record out of a stage and back never duplicates its work.

export function parseChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (i): i is ChecklistItem =>
        Boolean(i) && typeof i.title === 'string' && i.title.trim() !== ''
    )
    .map((i) => ({
      title: i.title.trim(),
      details:
        typeof i.details === 'string' && i.details.trim()
          ? i.details.trim()
          : undefined,
      department:
        typeof i.department === 'string' && i.department.trim()
          ? i.department.trim()
          : undefined,
      due_in_days:
        typeof i.due_in_days === 'number' && Number.isFinite(i.due_in_days)
          ? Math.max(0, Math.round(i.due_in_days))
          : undefined,
      blocking: i.blocking === true,
    }))
}

// Create the stage's checklist as tasks against the record.
//
// Idempotent by TITLE rather than all-or-nothing: moving a record out of a
// stage and back creates nothing new, but an item added to the stage after the
// record arrived can still be pulled in. An all-or-nothing check made the
// "Add this stage's tasks" button silently do nothing whenever the record
// already had even one task from the stage.
//
// Errors are returned, never swallowed — a silent 0 here is exactly what made
// the first version of this feature impossible to diagnose.
export async function generateStageTasks({
  supabase,
  organizationId,
  clientId,
  stage,
  userId,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
  organizationId: string
  clientId: string
  stage: Pick<PipelineStage, 'id' | 'checklist'>
  userId: string | null
}): Promise<{ created: number; error?: string }> {
  const items = parseChecklist(stage.checklist)
  if (items.length === 0) return { created: 0 }

  const { data: existing, error: readError } = await supabase
    .from('tasks')
    .select('title')
    .eq('client_id', clientId)
    .eq('origin_stage_id', stage.id)
  if (readError) return { created: 0, error: readError.message }

  const have = new Set(
    ((existing ?? []) as { title: string }[]).map((t) => t.title)
  )
  const missing = items.filter((i) => !have.has(i.title))
  if (missing.length === 0) return { created: 0 }

  const today = klToday()
  const rows = missing.map((item) => ({
    organization_id: organizationId,
    client_id: clientId,
    origin_stage_id: stage.id,
    title: item.title,
    details: item.details ?? null,
    department: item.department ?? null,
    due_date:
      item.due_in_days === undefined ? null : addDays(today, item.due_in_days),
    status: 'pending' as const,
    created_by: userId,
  }))

  const { error } = await supabase.from('tasks').insert(rows)
  if (error) return { created: 0, error: error.message }
  return { created: rows.length }
}

// Blocking items on the stage the record is LEAVING must be done before it can
// move forward. Backwards moves are never blocked — sending a job back to an
// earlier stage has to stay possible.
export async function blockingTasksFor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  clientId: string,
  stage: Pick<PipelineStage, 'id' | 'checklist'>
): Promise<string[]> {
  const blockingTitles = new Set(
    parseChecklist(stage.checklist)
      .filter((i) => i.blocking)
      .map((i) => i.title)
  )
  if (blockingTitles.size === 0) return []

  const { data } = await supabase
    .from('tasks')
    .select('title, status')
    .eq('client_id', clientId)
    .eq('origin_stage_id', stage.id)
    .neq('status', 'done')

  return ((data ?? []) as Pick<Task, 'title' | 'status'>[])
    .filter((t) => blockingTitles.has(t.title))
    .map((t) => t.title)
}

export function checklistProgress(
  tasks: Pick<Task, 'status'>[]
): { done: number; total: number } {
  return {
    done: tasks.filter((t) => t.status === 'done').length,
    total: tasks.length,
  }
}

// Board pill data, keyed by record id. Counts ONLY tasks from the stage each
// record is in right now — tasks left behind in an earlier stage would
// otherwise inflate the denominator and make the pill meaningless.
export function stageProgressByRecord(
  records: { id: string; stage_id: string | null }[],
  tasks:
    | { client_id: string | null; origin_stage_id: string | null; status: string }[]
    | null
): Record<string, { done: number; total: number }> {
  const stageOf = new Map(records.map((r) => [r.id, r.stage_id]))
  const out: Record<string, { done: number; total: number }> = {}
  for (const t of tasks ?? []) {
    if (!t.client_id) continue
    if (t.origin_stage_id !== stageOf.get(t.client_id)) continue
    const entry = (out[t.client_id] ??= { done: 0, total: 0 })
    entry.total += 1
    if (t.status === 'done') entry.done += 1
  }
  return out
}
