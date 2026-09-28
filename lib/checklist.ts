import type { ChecklistItem, Task } from '@/types/database'

// Stage checklists — the SOP layer.
//
// When a record lands in a stage, that stage's checklist becomes real tasks
// against the record, and unfinished "must finish first" items stop it moving
// forward. Since migration 020 BOTH rules live in the database
// (generate_stage_tasks() and the clients_stage_guard trigger), because six
// code paths change a stage and app-level hooks kept getting missed on some of
// them — the edit form could bypass blocking, and website signups never got a
// checklist. What stays here is parsing and display.

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
