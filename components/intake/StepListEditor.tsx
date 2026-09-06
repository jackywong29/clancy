'use client'

import { useState } from 'react'

function parse(initial: string): string[] {
  try {
    const steps = JSON.parse(initial)
    if (Array.isArray(steps) && steps.length > 0) return steps
  } catch {
    // fall through to default
  }
  return ['']
}

export function StepListEditor({
  name,
  initial,
}: {
  name: string
  initial: string
}) {
  const [steps, setSteps] = useState<string[]>(() => parse(initial))

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    const next = [...steps]
    ;[next[i], next[j]] = [next[j], next[i]]
    setSteps(next)
  }

  return (
    <div className="space-y-2">
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(steps.filter((s) => s.trim() !== ''))}
      />
      {steps.map((step, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet/15 text-xs font-medium text-violet">
            {i + 1}
          </span>
          <input
            value={step}
            onChange={(e) =>
              setSteps(steps.map((s, idx) => (idx === i ? e.target.value : s)))
            }
            placeholder={
              i === 0 ? 'e.g. Customer WhatsApps or walks in' : 'Next step…'
            }
            className="min-w-32 flex-1 rounded-lg border border-ash bg-graphite px-3 py-1.5 text-sm outline-none focus:border-violet"
          />
          <button
            type="button"
            onClick={() => move(i, -1)}
            aria-label="Move up"
            className="flex h-8 w-8 shrink-0 items-center justify-center text-ivory/40 hover:text-ivory disabled:opacity-30 sm:h-6 sm:w-6"
            disabled={i === 0}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => move(i, 1)}
            aria-label="Move down"
            className="flex h-8 w-8 shrink-0 items-center justify-center text-ivory/40 hover:text-ivory disabled:opacity-30 sm:h-6 sm:w-6"
            disabled={i === steps.length - 1}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => setSteps(steps.filter((_, idx) => idx !== i))}
            aria-label="Remove step"
            className="flex h-8 w-8 shrink-0 items-center justify-center text-ivory/40 hover:text-red-400 sm:h-6 sm:w-6"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setSteps([...steps, ''])}
        className="rounded-lg border border-dashed border-ash px-3 py-2 text-xs text-ivory/70 hover:border-violet hover:text-violet sm:py-1.5"
      >
        + Add step
      </button>
    </div>
  )
}
