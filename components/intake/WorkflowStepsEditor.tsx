'use client'

import { useState } from 'react'
import type { WorkflowStep } from '@/lib/intake'

// The client's own process, captured with enough structure to build from.
//
// Clients describe workflows vaguely ("customer calls, we fix it, they pay"),
// so every question is concrete and carries a worked example. The step name
// alone is enough to submit — detail sits behind "Add detail" so listing six
// steps on a phone isn't a wall of thirty inputs. Jacky fills the gaps after
// the conversation; client answers merge in and never overwrite his.

const DETAIL: {
  key: keyof Omit<WorkflowStep, 'name'>
  label: string
  example: string
  long?: boolean
}[] = [
  {
    key: 'tasks',
    label: 'What has to happen at this step?',
    example:
      'e.g. Take photos of the car · Write down what they say is wrong · Check if the parts are in stock',
    long: true,
  },
  {
    key: 'who',
    label: 'Who normally does it?',
    example: 'e.g. Front desk — or whoever picks up the phone',
  },
  {
    key: 'duration',
    label: 'How long does it usually take?',
    example: 'e.g. Same day, or about 2 days',
  },
  {
    key: 'blocker',
    label: 'What has to be finished before it moves on?',
    example: "e.g. We can't start work until the customer approves the quote",
  },
  {
    key: 'automatic',
    label: 'What do you always forget, or wish happened by itself?',
    example: 'e.g. Texting them the day before — I forget every time',
    long: true,
  },
]

function parse(initial: string): WorkflowStep[] {
  try {
    const rows = JSON.parse(initial)
    if (Array.isArray(rows) && rows.length > 0) {
      return rows
        .map((r) =>
          typeof r === 'string' ? { name: r } : (r as WorkflowStep)
        )
        .filter((r) => r && typeof r.name === 'string')
    }
  } catch {
    // fall through to a single empty step
  }
  return [{ name: '' }]
}

export function WorkflowStepsEditor({
  name,
  initial,
}: {
  name: string
  initial: string
}) {
  const [steps, setSteps] = useState<WorkflowStep[]>(() => parse(initial))
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true })

  const patch = (i: number, next: Partial<WorkflowStep>) =>
    setSteps((prev) => prev.map((s, x) => (x === i ? { ...s, ...next } : s)))

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    const next = [...steps]
    ;[next[i], next[j]] = [next[j], next[i]]
    setSteps(next)
  }

  const detailCount = (s: WorkflowStep) =>
    DETAIL.filter((d) => (s[d.key] ?? '').trim() !== '').length

  const field =
    'w-full min-w-0 rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet'

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(steps.filter((s) => s.name.trim() !== ''))}
      />

      {steps.map((step, i) => {
        const filled = detailCount(step)
        return (
          <div
            key={i}
            className="rounded-xl border border-ash/60 bg-carbon/40 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet/15 text-xs font-medium text-violet">
                {i + 1}
              </span>
              <input
                value={step.name}
                onChange={(e) => patch(i, { name: e.target.value })}
                placeholder={
                  i === 0
                    ? 'e.g. Customer WhatsApps or walks in'
                    : 'What happens next?'
                }
                aria-label={`Step ${i + 1}`}
                className={`${field} flex-1`}
              />
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move step ${i + 1} up`}
                className="flex h-8 w-8 shrink-0 items-center justify-center text-ivory/40 disabled:opacity-30 hover:enabled:text-ivory"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === steps.length - 1}
                aria-label={`Move step ${i + 1} down`}
                className="flex h-8 w-8 shrink-0 items-center justify-center text-ivory/40 disabled:opacity-30 hover:enabled:text-ivory"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => setSteps(steps.filter((_, x) => x !== i))}
                aria-label={`Remove step ${i + 1}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center text-ivory/40 hover:text-red-400"
              >
                ×
              </button>
            </div>

            <button
              type="button"
              onClick={() => setOpen({ ...open, [i]: !open[i] })}
              className="mt-2 text-xs text-ivory/50 hover:text-violet"
            >
              {open[i] ? 'Hide detail' : 'Add detail'}
              {filled > 0 && !open[i] && (
                <span className="ml-1 text-violet">· {filled} of 5 answered</span>
              )}
            </button>

            {open[i] && (
              <div className="mt-3 space-y-3 border-t border-ash/40 pt-3">
                {DETAIL.map((d) => (
                  <div key={d.key}>
                    <label className="mb-1 block text-xs text-ivory/70">
                      {d.label}
                    </label>
                    {d.long ? (
                      <textarea
                        rows={2}
                        value={step[d.key] ?? ''}
                        onChange={(e) => patch(i, { [d.key]: e.target.value })}
                        placeholder={d.example}
                        className={field}
                      />
                    ) : (
                      <input
                        value={step[d.key] ?? ''}
                        onChange={(e) => patch(i, { [d.key]: e.target.value })}
                        placeholder={d.example}
                        className={field}
                      />
                    )}
                  </div>
                ))}
                <p className="text-xs text-ivory/40">
                  Every answer is optional — the step name alone is useful. Skip
                  anything that doesn&apos;t apply.
                </p>
              </div>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => {
          setSteps([...steps, { name: '' }])
          setOpen({ ...open, [steps.length]: true })
        }}
        className="rounded-lg border border-dashed border-ash px-3 py-2 text-xs text-ivory/70 hover:border-violet hover:text-violet"
      >
        + Add step
      </button>
    </div>
  )
}
