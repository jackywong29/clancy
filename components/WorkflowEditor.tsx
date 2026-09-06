'use client'

import { useState } from 'react'
import type { ChecklistItem, Department, PipelineStage } from '@/types/database'

// The whole pipeline and its process on one screen, saved by one button.
//
// This replaces the old /stages page, where each stage card carried two rival
// Save buttons (the stage's own and the checklist's) and the checklist hid
// behind a disclosure triangle — so it was easy to lose checklist edits by
// clicking the wrong Save, and impossible to see the workflow end to end.

export interface StageDraft {
  id: string
  name: string
  position: number
  checklist: ChecklistItem[]
  inUse: number
}

const input =
  'rounded-lg border border-ash bg-graphite px-2 py-1.5 text-sm outline-none focus:border-violet'

export function WorkflowEditor({
  name,
  initial,
  departments,
  recordPlural,
}: {
  name: string
  initial: StageDraft[]
  departments: Department[]
  recordPlural: string
}) {
  const [stages, setStages] = useState<StageDraft[]>(initial)
  const [copyFrom, setCopyFrom] = useState<Record<string, string>>({})

  const patch = (i: number, next: Partial<StageDraft>) =>
    setStages((prev) => prev.map((s, x) => (x === i ? { ...s, ...next } : s)))

  const patchItem = (si: number, ii: number, next: Partial<ChecklistItem>) =>
    setStages((prev) =>
      prev.map((s, x) =>
        x === si
          ? {
              ...s,
              checklist: s.checklist.map((c, y) =>
                y === ii ? { ...c, ...next } : c
              ),
            }
          : s
      )
    )

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= stages.length) return
    const next = [...stages]
    ;[next[i], next[j]] = [next[j], next[i]]
    setStages(next.map((s, idx) => ({ ...s, position: idx + 1 })))
  }

  // Positions are derived from order on save, so the payload is always
  // consistent no matter how the columns were shuffled.
  const payload = stages.map((s, i) => ({
    id: s.id,
    name: s.name,
    position: i + 1,
    checklist: s.checklist.filter((c) => c.title.trim() !== ''),
  }))

  return (
    <div className="space-y-4">
      <input type="hidden" name={name} value={JSON.stringify(payload)} />

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {stages.map((stage, si) => {
          const blocking = stage.checklist.filter((c) => c.blocking).length
          return (
            <section
              key={stage.id}
              className="w-[85vw] max-w-[20rem] shrink-0 snap-start rounded-xl border border-ash/60 bg-carbon p-3 sm:w-72"
            >
              <div className="mb-2 flex items-center gap-1">
                <input
                  value={stage.name}
                  onChange={(e) => patch(si, { name: e.target.value })}
                  aria-label={`Stage ${si + 1} name`}
                  className={`${input} min-w-0 flex-1 font-medium`}
                />
                <button
                  type="button"
                  onClick={() => move(si, -1)}
                  disabled={si === 0}
                  aria-label={`Move ${stage.name} left`}
                  className="rounded border border-ash px-1.5 py-1 text-xs text-ivory/60 disabled:opacity-30 hover:enabled:border-violet hover:enabled:text-violet"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(si, 1)}
                  disabled={si === stages.length - 1}
                  aria-label={`Move ${stage.name} right`}
                  className="rounded border border-ash px-1.5 py-1 text-xs text-ivory/60 disabled:opacity-30 hover:enabled:border-violet hover:enabled:text-violet"
                >
                  →
                </button>
              </div>

              <p className="mb-3 text-xs text-ivory/50">
                {stage.inUse} {stage.inUse === 1 ? 'record' : 'records'}
                {stage.checklist.length > 0 && (
                  <>
                    {' · '}
                    {stage.checklist.length} task
                    {stage.checklist.length === 1 ? '' : 's'}
                    {blocking > 0 && `, ${blocking} blocking`}
                  </>
                )}
              </p>

              <div className="space-y-2">
                {stage.checklist.map((item, ii) => (
                  <div
                    key={ii}
                    className="rounded-lg border border-ash/50 bg-graphite/40 p-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <input
                        value={item.title}
                        onChange={(e) =>
                          patchItem(si, ii, { title: e.target.value })
                        }
                        placeholder="What needs doing"
                        aria-label="Task title"
                        className={`${input} min-w-0 flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patch(si, {
                            checklist: stage.checklist.filter(
                              (_, y) => y !== ii
                            ),
                          })
                        }
                        aria-label={`Remove ${item.title || 'item'}`}
                        className="shrink-0 text-ivory/40 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <select
                        value={item.department ?? ''}
                        onChange={(e) =>
                          patchItem(si, ii, {
                            department: e.target.value || undefined,
                          })
                        }
                        aria-label="Department"
                        className={`${input} text-xs`}
                      >
                        <option value="">Anyone</option>
                        {departments.map((d) => (
                          <option key={d.key} value={d.key}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-ivory/50">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.due_in_days ?? ''}
                          onChange={(e) =>
                            patchItem(si, ii, {
                              due_in_days:
                                e.target.value === ''
                                  ? undefined
                                  : Math.max(0, Number(e.target.value)),
                            })
                          }
                          placeholder="—"
                          aria-label="Due in days"
                          className={`${input} w-14 text-xs`}
                        />
                        days
                      </label>
                      <label
                        className="flex items-center gap-1 text-xs text-ivory/50"
                        title="The record can't move forward until this is ticked"
                      >
                        <input
                          type="checkbox"
                          checked={item.blocking === true}
                          onChange={(e) =>
                            patchItem(si, ii, { blocking: e.target.checked })
                          }
                          className="h-3.5 w-3.5 accent-violet"
                        />
                        blocks
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  patch(si, { checklist: [...stage.checklist, { title: '' }] })
                }
                className="mt-2 w-full rounded-lg border border-dashed border-ash px-2 py-1.5 text-xs text-ivory/60 hover:border-violet hover:text-violet"
              >
                + Add task
              </button>

              {stages.length > 1 && (
                <div className="mt-2 flex gap-1">
                  <select
                    value={copyFrom[stage.id] ?? ''}
                    onChange={(e) =>
                      setCopyFrom({ ...copyFrom, [stage.id]: e.target.value })
                    }
                    aria-label={`Copy a checklist into ${stage.name}`}
                    className={`${input} min-w-0 flex-1 text-xs`}
                  >
                    <option value="">Copy from…</option>
                    {stages
                      .filter((s, x) => x !== si && s.checklist.length > 0)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.checklist.length})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!copyFrom[stage.id]}
                    onClick={() => {
                      const src = stages.find((s) => s.id === copyFrom[stage.id])
                      if (!src) return
                      const have = new Set(
                        stage.checklist.map((c) => c.title.trim())
                      )
                      patch(si, {
                        checklist: [
                          ...stage.checklist,
                          ...src.checklist
                            .filter((c) => !have.has(c.title.trim()))
                            .map((c) => ({ ...c })),
                        ],
                      })
                      setCopyFrom({ ...copyFrom, [stage.id]: '' })
                    }}
                    className="rounded-lg border border-ash px-2 py-1 text-xs text-ivory/60 disabled:opacity-30 hover:enabled:border-violet hover:enabled:text-violet"
                  >
                    Copy
                  </button>
                </div>
              )}

              <p className="mt-3 border-t border-ash/40 pt-2 text-xs text-ivory/40">
                {stage.checklist.filter((c) => c.title.trim()).length === 0
                  ? `${recordPlural} entering this stage get no tasks.`
                  : `A record entering ${stage.name || 'this stage'} gets ${
                      stage.checklist.filter((c) => c.title.trim()).length
                    } task${
                      stage.checklist.filter((c) => c.title.trim()).length === 1
                        ? ''
                        : 's'
                    }${blocking > 0 ? `, ${blocking} blocking` : ''}.`}
              </p>
            </section>
          )
        })}
      </div>
    </div>
  )
}
