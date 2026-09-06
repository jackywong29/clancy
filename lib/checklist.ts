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

// Have this record's tasks for this stage already been generated? One query,
// head-only — this runs on every stage move.
async function alreadyGenerated(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  clientId: string,
  stageId: string
): Promise<boolean> {
  const { count } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('origin_stage_id', stageId)
  return (count ?? 0) > 0
}

// Create the stage's checklist as tasks against the record. Returns how many
// were created (0 when the stage has no checklist, or they already exist).
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
}): Promise<number> {
  const items = parseChecklist(stage.checklist)
  if (items.length === 0) return 0
  if (await alreadyGenerated(supabase, clientId, stage.id)) return 0

  const today = klToday()
  const rows = items.map((item) => ({
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
  return error ? 0 : rows.length
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
