import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOrg } from '@/lib/actions'
import { Header } from '@/components/Header'
import { ClientTabs } from '@/components/ClientTabs'
import { CopyButton } from '@/components/CopyButton'
import { buildBrief, intakeProgress, type IntakeData } from '@/lib/intake'
import type { Client, Intake } from '@/types/database'

export default async function BriefPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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
  const brief = await buildBrief(client, data, supabase)

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="mb-1 text-2xl font-medium">{client.company_name}</h1>
        <p className="mb-6 text-sm text-ivory/60">Build brief</p>
        <ClientTabs clientId={client.id} active="brief" />

        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-sm text-ivory/60">
            {progress.percent}% of intake answered
            {progress.blockingMissing.length > 0 && (
              <span className="text-red-400">
                {' '}
                · {progress.blockingMissing.length} blocking missing
              </span>
            )}
          </p>
          <CopyButton text={brief} />
        </div>

        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-ash/60 bg-carbon p-4 font-mono text-xs leading-relaxed sm:p-5">
          {brief}
        </pre>

        <p className="mt-4 text-xs text-ivory/50">
          Copy this and hand it to Claude with &quot;build{' '}
          {client.company_name}&quot; — it contains everything collected so
          far.
        </p>
      </main>
    </div>
  )
}
