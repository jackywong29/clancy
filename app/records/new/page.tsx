import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addRecord, requireOrg } from '@/lib/actions'
import { Header } from '@/components/Header'
import { RecordFields } from '@/components/RecordFields'
import { recordLabel } from '@/lib/crm'
import type { CrmConfig, Organization, PipelineStage } from '@/types/database'

export default async function NewRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; msg?: string }>
}) {
  const flags = await searchParams
  const orgId = await requireOrg()
  const supabase = await createClient()

  const [{ data: orgRow }, { data: stages }] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', orgId).maybeSingle(),
    supabase
      .from('pipeline_stages')
      .select('*')
      .order('position', { ascending: true }),
  ])
  const org = orgRow as Organization | null
  if (org?.slug === 'clancy') redirect('/clients/new')
  const config = (org?.crm_config ?? {}) as CrmConfig

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-medium">
          Add {recordLabel(config).toLowerCase()}
        </h1>
        {flags.error && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            Couldn&apos;t save{flags.msg ? `: ${flags.msg}` : '.'}
          </p>
        )}
        <form action={addRecord} className="space-y-4">
          <RecordFields
            config={config}
            stages={(stages ?? []) as PipelineStage[]}
          />
          <button
            type="submit"
            className="rounded-lg bg-violet-deep px-5 py-2.5 text-sm font-medium text-white hover:bg-violet"
          >
            Save
          </button>
        </form>
      </main>
    </div>
  )
}
