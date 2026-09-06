import Link from 'next/link'
import { moveClientStage } from '@/lib/actions'
import { recordLabel, crmFields, cardFieldKeys, customValue } from '@/lib/crm'
import { BUILTIN_FIELDS } from '@/lib/crm'
import type { Client, CrmConfig, PipelineStage } from '@/types/database'

function displayValue(record: Client, key: string, config: CrmConfig): string {
  if (key === 'name') return record.company_name
  if (key === BUILTIN_FIELDS.phone || key === 'phone') return record.phone ?? ''
  if (key === BUILTIN_FIELDS.email || key === 'email') return record.email ?? ''
  const field = crmFields(config).find((f) => f.key === key)
  const raw = customValue(record.custom, key)
  if (field?.type === 'date' && raw) return raw
  return raw
}

export function RecordsBoard({
  stages,
  records,
  config,
  // Checklist progress for the stage each record currently sits in, keyed by
  // record id. Absent when the record's stage has no checklist.
  checklistProgress = {},
  notice = null,
}: {
  stages: PipelineStage[]
  records: Client[]
  config: CrmConfig
  checklistProgress?: Record<string, { done: number; total: number }>
  notice?: string | null
}) {
  const singular = recordLabel(config)
  const plural = recordLabel(config, true)
  const cardKeys = cardFieldKeys(config)
  const fieldLabel = (key: string) =>
    crmFields(config).find((f) => f.key === key)?.label ?? key

  return (
    <div className="min-h-screen">
      <main className="w-full px-4 py-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-medium">{plural}</h1>
            <p className="text-sm text-ivory/60">
              {records.length} {records.length === 1 ? singular.toLowerCase() : plural.toLowerCase()} across {stages.length} stages
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/crm"
              className="rounded-lg border border-ash px-3 py-2 text-sm hover:border-violet hover:text-violet"
            >
              Customize
            </Link>
            <Link
              href="/records/new"
              className="rounded-lg bg-violet-deep px-4 py-2 text-sm font-medium text-white hover:bg-violet"
            >
              Add {singular.toLowerCase()}
            </Link>
          </div>
        </div>

        {notice && (
          <p className="mb-4 rounded-lg bg-amber-950/30 px-3 py-2 text-sm text-amber-300">
            {notice}
          </p>
        )}

        {stages.length === 0 ? (
          <p className="text-sm text-ivory/60">
            No stages yet — add some on the Stages page.
          </p>
        ) : records.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ash bg-carbon/50 p-6 text-center sm:p-10">
            <p className="text-lg font-medium">No {plural.toLowerCase()} yet.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ivory/60">
              Add your first {singular.toLowerCase()} to start tracking.
            </p>
            <Link
              href="/records/new"
              className="mt-5 inline-block rounded-lg bg-violet-deep px-5 py-2.5 text-sm font-medium text-white hover:bg-violet"
            >
              Add {singular.toLowerCase()}
            </Link>
          </div>
        ) : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:snap-none sm:px-0">
            {stages.map((stage) => {
              const stageRecords = records.filter((r) => r.stage_id === stage.id)
              return (
                <section
                  key={stage.id}
                  className="w-[78vw] max-w-[17rem] shrink-0 snap-start rounded-xl bg-carbon/50 p-3 sm:w-64 sm:max-w-none"
                >
                  <h2 className="mb-3 flex items-baseline justify-between px-1 text-sm font-medium">
                    {stage.name}
                    <span className="text-xs font-normal text-ivory/50">
                      {stageRecords.length}
                    </span>
                  </h2>
                  <div className="space-y-2">
                    {stageRecords.map((record) => (
                      <article
                        key={record.id}
                        className="rounded-lg border border-ash/60 bg-carbon p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/records/${record.id}`}
                            className="block min-w-0 flex-1 break-words text-sm font-medium hover:text-violet"
                          >
                            {record.company_name}
                          </Link>
                          {checklistProgress[record.id] && (
                            <span
                              title="Stage checklist progress"
                              className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${
                                checklistProgress[record.id].done ===
                                checklistProgress[record.id].total
                                  ? 'bg-violet/15 text-violet'
                                  : 'bg-ash/40 text-ivory/60'
                              }`}
                            >
                              {checklistProgress[record.id].done}/
                              {checklistProgress[record.id].total}
                            </span>
                          )}
                        </div>
                        {cardKeys.map((key) => {
                          const val = displayValue(record, key, config)
                          if (!val) return null
                          return (
                            <p key={key} className="mt-0.5 break-words text-xs text-ivory/60">
                              {fieldLabel(key)}: {val}
                            </p>
                          )
                        })}
                        <form
                          action={moveClientStage}
                          className="mt-2 flex flex-wrap gap-1"
                        >
                          <input type="hidden" name="client_id" value={record.id} />
                          <select
                            name="stage_id"
                            defaultValue={stage.id}
                            className="min-w-0 flex-1 rounded border border-ash bg-graphite px-1 py-1.5 sm:text-xs"
                          >
                            {stages.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded border border-ash px-2 py-1.5 text-xs hover:border-violet hover:text-violet"
                          >
                            Move
                          </button>
                        </form>
                      </article>
                    ))}
                    {stageRecords.length === 0 && (
                      <p className="px-1 py-2 text-xs text-ivory/40">Empty</p>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
