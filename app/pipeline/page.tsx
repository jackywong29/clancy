import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { moveClientStage, requireOrg } from '@/lib/actions'
import { Header } from '@/components/Header'
import { intakeProgress } from '@/lib/intake'
import type { Client, Intake, PipelineStage } from '@/types/database'

function formatRM(value: number) {
  return `RM ${value.toLocaleString('en-MY', { maximumFractionDigits: 0 })}`
}

export default async function PipelinePage() {
  await requireOrg()
  const supabase = await createClient()

  const [{ data: stages }, { data: clients }, { data: intakes }] =
    await Promise.all([
      supabase
        .from('pipeline_stages')
        .select('*')
        .order('position', { ascending: true }),
      supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('intakes').select('client_id, data'),
    ])

  const stageList = (stages ?? []) as PipelineStage[]
  const clientList = (clients ?? []) as Client[]
  const intakeByClient = new Map(
    ((intakes ?? []) as Pick<Intake, 'client_id' | 'data'>[]).map((i) => [
      i.client_id,
      i.data,
    ])
  )

  const activeStage = stageList.find((s) => s.name === 'Active')
  const activeClients = clientList.filter(
    (c) => activeStage && c.stage_id === activeStage.id
  )
  const mrr = activeClients.reduce((sum, c) => sum + (c.mrr ?? 0), 0)

  return (
    <div className="min-h-screen">
      <Header />
      <main className="px-6 py-5">
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-mist/50 bg-white p-4">
            <p className="text-xs text-graphite/60">Total in pipeline</p>
            <p className="mt-1 text-2xl font-medium">{clientList.length}</p>
          </div>
          <div className="rounded-xl border border-mist/50 bg-white p-4">
            <p className="text-xs text-graphite/60">Active clients</p>
            <p className="mt-1 text-2xl font-medium">{activeClients.length}</p>
          </div>
          <div className="rounded-xl border border-mist/50 bg-white p-4">
            <p className="text-xs text-graphite/60">MRR</p>
            <p className="mt-1 text-2xl font-medium">{formatRM(mrr)}</p>
          </div>
          <div className="rounded-xl border border-mist/50 bg-white p-4">
            <p className="text-xs text-graphite/60">Stages</p>
            <p className="mt-1 text-2xl font-medium">{stageList.length}</p>
          </div>
        </div>

        {stageList.length === 0 ? (
          <p className="text-sm text-graphite/60">
            No pipeline stages found — run the schema SQL in Supabase first.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {stageList.map((stage) => {
              const stageClients = clientList.filter(
                (c) => c.stage_id === stage.id
              )
              return (
                <section
                  key={stage.id}
                  className="w-64 shrink-0 rounded-xl bg-mist/20 p-3"
                >
                  <h2 className="mb-3 flex items-baseline justify-between px-1 text-sm font-medium">
                    {stage.name}
                    <span className="text-xs font-normal text-graphite/50">
                      {stageClients.length}
                    </span>
                  </h2>
                  <div className="space-y-2">
                    {stageClients.map((client) => (
                      <article
                        key={client.id}
                        className="rounded-lg border border-mist/60 bg-white p-3"
                      >
                        <Link
                          href={`/clients/${client.id}`}
                          className="text-sm font-medium hover:text-violet-deep"
                        >
                          {client.company_name}
                        </Link>
                        <p className="mt-0.5 text-xs text-graphite/60">
                          {[client.vertical, client.tier, client.source]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </p>
                        {client.mrr !== null && (
                          <p className="mt-1 text-xs font-medium text-violet-deep">
                            {formatRM(client.mrr)}/mo
                          </p>
                        )}
                        {client.renewal_date && (
                          <p className="mt-0.5 text-xs text-graphite/50">
                            Renews {client.renewal_date}
                          </p>
                        )}
                        {intakeByClient.has(client.id) &&
                          (() => {
                            const p = intakeProgress(
                              intakeByClient.get(client.id) ?? {}
                            )
                            return (
                              <div className="mt-2">
                                <div className="h-1 rounded-full bg-mist/40">
                                  <div
                                    className="h-1 rounded-full bg-violet"
                                    style={{ width: `${p.percent}%` }}
                                  />
                                </div>
                                <p className="mt-1 text-xs text-graphite/50">
                                  Intake {p.percent}%
                                  {p.blockingMissing.length > 0 &&
                                    ` · ${p.blockingMissing.length} blocking`}
                                </p>
                              </div>
                            )
                          })()}
                        <form
                          action={moveClientStage}
                          className="mt-2 flex gap-1"
                        >
                          <input
                            type="hidden"
                            name="client_id"
                            value={client.id}
                          />
                          <select
                            name="stage_id"
                            defaultValue={stage.id}
                            className="w-full rounded border border-mist bg-porcelain px-1 py-1 text-xs"
                          >
                            {stageList.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded border border-mist px-2 py-1 text-xs hover:border-violet hover:text-violet-deep"
                          >
                            Move
                          </button>
                        </form>
                      </article>
                    ))}
                    {stageClients.length === 0 && (
                      <p className="px-1 py-2 text-xs text-graphite/40">
                        Empty
                      </p>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        <Link
          href="/clients/new"
          className="mt-2 inline-block rounded-lg bg-violet-deep px-4 py-2 text-sm font-medium text-white hover:bg-violet"
        >
          Add client
        </Link>
      </main>
    </div>
  )
}
