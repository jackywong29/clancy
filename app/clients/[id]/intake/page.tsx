import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { saveIntake, requireOrg } from '@/lib/actions'
import { Header } from '@/components/Header'
import { ClientTabs } from '@/components/ClientTabs'
import { INTAKE_SECTIONS, intakeProgress, type IntakeData } from '@/lib/intake'
import type { Client, Intake } from '@/types/database'

const inputClass =
  'w-full rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet'

export default async function IntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const { id } = await params
  const flags = await searchParams
  await requireOrg()
  const supabase = await createClient()

  const [{ data: clientRow }, { data: intakeRow }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).maybeSingle(),
    supabase.from('intakes').select('*').eq('client_id', id).maybeSingle(),
  ])

  if (!clientRow) {
    notFound()
  }
  const client = clientRow as Client
  const data: IntakeData = (intakeRow as Intake | null)?.data ?? {}
  const progress = intakeProgress(data)

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="mb-1 text-2xl font-medium">{client.company_name}</h1>
        <p className="mb-6 text-sm text-ivory/60">Intake</p>
        <ClientTabs clientId={client.id} active="intake" />

        <details className="mb-4 rounded-xl border border-ash/60 bg-carbon/50 p-4 text-sm text-ivory/80">
          <summary className="cursor-pointer font-medium text-ivory">
            How to run an intake (tips)
          </summary>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>
              Don&apos;t show the client this form — sections 1–5 are just one
              relaxed 45–60 min conversation about their business. Fill it in
              as they talk (or after, from notes).
            </li>
            <li>
              The trial site can be built from sections 1–4 alone — don&apos;t
              wait for a complete intake to create momentum.
            </li>
            <li>
              Photos and Google Business Profile access are the two items
              clients always drag on. Chase early, chase often.
            </li>
            <li>
              Red-starred items block the build — the brief will flag any
              that are missing.
            </li>
          </ul>
        </details>

        <div className="mb-6 rounded-xl border border-ash/60 bg-carbon p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-sm font-medium">
              {progress.filled} of {progress.total} answered
            </p>
            <p className="text-sm text-ivory/60">{progress.percent}%</p>
          </div>
          <div className="h-1.5 rounded-full bg-ash/50">
            <div
              className="h-1.5 rounded-full bg-violet"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          {progress.blockingMissing.length > 0 && (
            <p className="mt-3 text-xs text-ivory/60">
              <span className="font-medium text-red-400">
                {progress.blockingMissing.length} blocking missing:
              </span>{' '}
              {progress.blockingMissing.join(' · ')}
            </p>
          )}
        </div>

        {flags.saved && (
          <p className="mb-4 rounded-lg bg-violet/10 px-3 py-2 text-sm text-violet">
            Saved.
          </p>
        )}
        {flags.error && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            Couldn&apos;t save. Try again.
          </p>
        )}

        <form action={saveIntake} className="space-y-8">
          <input type="hidden" name="client_id" value={client.id} />
          {INTAKE_SECTIONS.map((section) => (
            <section key={section.key}>
              <h2 className="mb-3 text-lg font-medium">{section.title}</h2>
              <div className="space-y-3">
                {section.fields.map((field) => {
                  const name = `${section.key}.${field.key}`
                  const value = data[name] ?? ''
                  return (
                    <div key={name}>
                      <label htmlFor={name} className="mb-1 block text-sm">
                        {field.label}
                        {field.blocking && (
                          <span className="ml-1 font-medium text-red-400">
                            *
                          </span>
                        )}
                      </label>
                      {field.long ? (
                        <textarea
                          id={name}
                          name={name}
                          rows={3}
                          defaultValue={value}
                          placeholder={field.hint}
                          className={inputClass}
                        />
                      ) : (
                        <input
                          id={name}
                          name={name}
                          defaultValue={value}
                          placeholder={field.hint}
                          className={inputClass}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
          <div className="sticky bottom-4">
            <button
              type="submit"
              className="w-full rounded-lg bg-violet-deep px-5 py-3 text-sm font-medium text-white hover:bg-violet"
            >
              Save intake
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
