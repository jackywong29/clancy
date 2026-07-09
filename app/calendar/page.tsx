import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { addEvent, deleteEvent, requireOrg } from '@/lib/actions'
import { Header } from '@/components/Header'
import type { CalendarEvent, Client, Task } from '@/types/database'

const inputClass =
  'rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet'

function ym(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(year, month - 1 + delta, 1)
  return ym(d)
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>
}) {
  const flags = await searchParams
  await requireOrg()
  const supabase = await createClient()

  const now = new Date()
  const param = /^\d{4}-\d{2}$/.test(flags.m ?? '') ? flags.m! : ym(now)
  const [year, month] = param.split('-').map(Number)

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDay = `${param}-01`
  const lastDay = `${param}-${String(daysInMonth).padStart(2, '0')}`
  const startOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: events }, { data: tasks }, { data: records }] =
    await Promise.all([
      supabase
        .from('events')
        .select('*')
        .gte('starts_on', firstDay)
        .lte('starts_on', lastDay)
        .order('starts_on'),
      supabase
        .from('tasks')
        .select('*')
        .gte('due_date', firstDay)
        .lte('due_date', lastDay)
        .neq('status', 'done'),
      supabase.from('clients').select('id, company_name').order('company_name'),
    ])

  const eventList = (events ?? []) as CalendarEvent[]
  const taskList = (tasks ?? []) as Task[]
  const recordList = (records ?? []) as Pick<Client, 'id' | 'company_name'>[]

  const cells: (number | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const dateStr = (day: number) =>
    `${param}-${String(day).padStart(2, '0')}`

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-medium">
            {MONTH_NAMES[month - 1]} {year}
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href={`/calendar?m=${shiftMonth(year, month, -1)}`}
              className="rounded-lg border border-ash px-3 py-1.5 text-sm hover:border-violet hover:text-violet"
            >
              ←
            </Link>
            <Link
              href={`/calendar?m=${ym(now)}`}
              className="rounded-lg border border-ash px-3 py-1.5 text-sm hover:border-violet hover:text-violet"
            >
              Today
            </Link>
            <Link
              href={`/calendar?m=${shiftMonth(year, month, 1)}`}
              className="rounded-lg border border-ash px-3 py-1.5 text-sm hover:border-violet hover:text-violet"
            >
              →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-ash/60 bg-ash/40">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="bg-carbon px-2 py-1.5 text-center text-xs font-medium text-ivory/60"
            >
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            const ds = day ? dateStr(day) : null
            const dayEvents = ds ? eventList.filter((e) => e.starts_on === ds) : []
            const dayTasks = ds ? taskList.filter((t) => t.due_date === ds) : []
            return (
              <div
                key={i}
                className={`min-h-24 bg-graphite p-1.5 ${day ? '' : 'opacity-40'}`}
              >
                {day && (
                  <>
                    <p
                      className={`mb-1 text-xs ${
                        ds === today
                          ? 'inline-block rounded bg-violet px-1.5 py-0.5 font-medium text-white'
                          : 'text-ivory/50'
                      }`}
                    >
                      {day}
                    </p>
                    <div className="space-y-1">
                      {dayEvents.map((event) => (
                        <form
                          key={event.id}
                          action={deleteEvent}
                          className="group rounded bg-violet/15 px-1.5 py-1 text-xs text-violet"
                          title={event.details ?? event.title}
                        >
                          <input type="hidden" name="event_id" value={event.id} />
                          <span>
                            {event.event_time && (
                              <span className="opacity-70">{event.event_time} </span>
                            )}
                            {event.title}
                          </span>
                          <button
                            type="submit"
                            aria-label={`Delete ${event.title}`}
                            className="ml-1 hidden text-violet/60 hover:text-red-400 group-hover:inline"
                          >
                            ×
                          </button>
                        </form>
                      ))}
                      {dayTasks.map((task) => (
                        <Link
                          key={task.id}
                          href="/tasks"
                          className="block rounded bg-ash/40 px-1.5 py-1 text-xs text-ivory/70"
                        >
                          ☐ {task.title}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        <form
          action={addEvent}
          className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-ash bg-carbon/50 p-3"
        >
          <input
            name="title"
            required
            placeholder="New event…"
            className={`${inputClass} flex-1`}
          />
          <input
            name="starts_on"
            type="date"
            required
            defaultValue={param === ym(now) ? today : firstDay}
            className={inputClass}
            aria-label="Date"
          />
          <input
            name="event_time"
            placeholder="7:30pm"
            className={`${inputClass} w-24`}
            aria-label="Time"
          />
          <select name="client_id" className={inputClass} aria-label="Linked record">
            <option value="">No linked record</option>
            {recordList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.company_name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-violet-deep px-4 py-2 text-sm font-medium text-white hover:bg-violet"
          >
            Add event
          </button>
        </form>
        <p className="mt-3 text-xs text-ivory/50">
          Events show in violet; open tasks with due dates show as ☐. Hover an
          event to delete it.
        </p>
      </main>
    </div>
  )
}
