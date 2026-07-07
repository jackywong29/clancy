import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { saveIntake, requireOrg } from '@/lib/actions'
import { Header } from '@/components/Header'
import { ClientTabs } from '@/components/ClientTabs'
import { INTAKE_SECTIONS, intakeProgress, type IntakeData } from '@/lib/intake'
import type { Client, Intake } from '@/types/database'

const inputClass =
  'w-full rounded-lg border border-mist bg-porcelain px-3 py-2 text-sm outline-none focus:border-violet'

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
        <p className="mb-6 text-sm text-graphite/60">Intake</p>
        <ClientTabs clientId={client.id} active="intake" />

        <div className="mb-6 rounded-xl border border-mist/50 bg-white p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-sm font-medium">
              {progress.filled} of {progress.total} answered
            </p>
            <p className="text-sm text-graphite/60">{progress.percent}%</p>
          </div>
          <div className="h-1.5 rounded-full bg-mist/40">
            <div
              className="h-1.5 rounded-full bg-violet"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          {progress.blockingMissing.length > 0 && (
            <p className="mt-3 text-xs text-graphite/60">
              <span className="font-medium text-red-600">
                {progress.blockingMissing.length} blocking missing:
              </span>{' '}
              {progress.blockingMissing.join(' · ')}
            </p>
          )}
        </div>

        {flags.saved && (
          <p className="mb-4 rounded-lg bg-violet/10 px-3 py-2 text-sm text-violet-deep">
            Saved.
          </p>
        )}
        {flags.error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
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
                          <span className="ml-1 font-medium text-red-600">
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
