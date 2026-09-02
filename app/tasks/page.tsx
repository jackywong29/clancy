import { createClient } from '@/lib/supabase/server'
import { addTask, updateTaskStatus, deleteTask } from '@/lib/actions'
import { Header } from '@/components/Header'
import { getMembership, hasRole } from '@/lib/permissions'
import { klToday } from '@/lib/dates'
import type { Client, Profile, Task, TaskStatus } from '@/types/database'

const inputClass =
  'rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet'

const STATUS_META: Record<TaskStatus, { label: string; next?: TaskStatus; nextLabel?: string }> = {
  pending: { label: 'To do', next: 'in_progress', nextLabel: 'Start' },
  in_progress: { label: 'In progress', next: 'done', nextLabel: 'Done' },
  done: { label: 'Done', next: 'pending', nextLabel: 'Reopen' },
}

export default async function TasksPage() {
  const m = await getMembership()
  const canEdit = hasRole(m, 'editor')
  const departments = m.crmConfig.departments ?? []
  const deptName = (key: string | null) =>
    departments.find((d) => d.key === key)?.name ?? null
  const supabase = await createClient()

  const [{ data: tasks }, { data: members }, { data: records }] =
    await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email'),
      supabase
        .from('clients')
        .select('id, company_name')
        .order('company_name'),
    ])

  const allTasks = (tasks ?? []) as Task[]
  const taskList =
    m.role === 'admin'
      ? allTasks
      : allTasks.filter(
          (t) => t.department === null || t.department === m.department
        )
  const memberList = (members ?? []) as Pick<Profile, 'id' | 'full_name' | 'email'>[]
  const recordList = (records ?? []) as Pick<Client, 'id' | 'company_name'>[]

  const memberName = (id: string | null) => {
    if (!id) return null
    const m = memberList.find((p) => p.id === id)
    return m?.full_name || m?.email || null
  }
  const recordName = (id: string | null) =>
    recordList.find((r) => r.id === id)?.company_name ?? null

  const today = klToday()
  const statuses: TaskStatus[] = ['pending', 'in_progress', 'done']

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-1 text-2xl font-medium">Tasks</h1>
        <p className="mb-6 text-sm text-ivory/60">
          Everything the team needs to do, in one list.
        </p>

        {canEdit && (
        <form
          action={addTask}
          className="mb-8 space-y-2 rounded-xl border border-dashed border-ash bg-carbon/50 p-3"
        >
          <input
            name="title"
            required
            placeholder="New task…"
            className={`${inputClass} w-full`}
          />
          <div className="flex flex-wrap gap-2">
            <select
              name="assignee_id"
              className={`${inputClass} w-full sm:w-auto`}
              aria-label="Assignee"
            >
              <option value="">Unassigned</option>
              {memberList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email}
                </option>
              ))}
            </select>
            <input
              name="due_date"
              type="date"
              className={`${inputClass} w-full sm:w-auto`}
              aria-label="Due date"
            />
            <select
              name="department"
              className={`${inputClass} w-full sm:w-auto`}
              aria-label="Department"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              name="client_id"
              className={`${inputClass} w-full sm:w-auto`}
              aria-label="Linked record"
            >
              <option value="">No linked record</option>
              {recordList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.company_name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="w-full rounded-lg bg-violet-deep px-4 py-2 text-sm font-medium text-white hover:bg-violet sm:w-auto"
            >
              Add task
            </button>
          </div>
        </form>
        )}

        {statuses.map((status) => {
          const group = taskList.filter((t) => t.status === status)
          return (
            <section key={status} className="mb-6">
              <h2 className="mb-2 flex items-baseline gap-2 text-sm font-medium">
                {STATUS_META[status].label}
                <span className="text-xs font-normal text-ivory/50">
                  {group.length}
                </span>
              </h2>
              <div className="space-y-2">
                {group.map((task) => {
                  const overdue =
                    task.status !== 'done' &&
                    task.due_date !== null &&
                    task.due_date < today
                  const meta = STATUS_META[task.status]
                  return (
                    <div
                      key={task.id}
                      className={`flex flex-wrap items-center gap-3 rounded-xl border bg-carbon p-3 ${
                        overdue ? 'border-red-950' : 'border-ash/60'
                      } ${task.status === 'done' ? 'opacity-60' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={`break-words text-sm font-medium ${
                            task.status === 'done' ? 'line-through' : ''
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className="break-words text-xs text-ivory/60">
                          {[
                            memberName(task.assignee_id),
                            task.due_date &&
                              `due ${task.due_date}${overdue ? ' · overdue' : ''}`,
                            deptName(task.department),
                            recordName(task.client_id),
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Unassigned'}
                        </p>
                      </div>
                      {canEdit && meta.next && (
                        <form action={updateTaskStatus}>
                          <input type="hidden" name="task_id" value={task.id} />
                          <input type="hidden" name="status" value={meta.next} />
                          <button
                            type="submit"
                            className="rounded-lg border border-ash px-3 py-2 text-sm hover:border-violet hover:text-violet sm:py-1.5"
                          >
                            {meta.nextLabel}
                          </button>
                        </form>
                      )}
                      {canEdit && (
                      <form action={deleteTask}>
                        <input type="hidden" name="task_id" value={task.id} />
                        <button
                          type="submit"
                          aria-label={`Delete ${task.title}`}
                          className="px-2 py-2 text-ivory/40 hover:text-red-400 sm:px-1 sm:py-1"
                        >
                          ×
                        </button>
                      </form>
                      )}
                    </div>
                  )
                })}
                {group.length === 0 && (
                  <p className="rounded-xl border border-dashed border-ash/50 bg-carbon/30 p-3 text-xs text-ivory/40">
                    Nothing here.
                  </p>
                )}
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}
