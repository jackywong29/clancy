import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateRecord, deleteRecord, requireOrg } from '@/lib/actions'
import { Header } from '@/components/Header'
import { RecordFields } from '@/components/RecordFields'
import { ConfirmForm } from '@/components/ConfirmForm'
import { recordLabel } from '@/lib/crm'
import type {
  Client,
  CrmConfig,
  Organization,
  PipelineStage,
} from '@/types/database'

export default async function RecordDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; error?: string; msg?: string }>
}) {
  const { id } = await params
  const flags = await searchParams
  const orgId = await requireOrg()
  const supabase = await createClient()

  const [{ data: orgRow }, { data: recordRow }, { data: stages }] =
    await Promise.all([
      supabase.from('organizations').select('*').eq('id', orgId).maybeSingle(),
      supabase.from('clients').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('pipeline_stages')
        .select('*')
        .order('position', { ascending: true }),
    ])

  const org = orgRow as Organization | null
  if (org?.slug === 'clancy') redirect(`/clients/${id}`)
  if (!recordRow) notFound()

  const record = recordRow as Client
  const config = (org?.crm_config ?? {}) as CrmConfig

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-medium">{record.company_name}</h1>
          <Link href="/pipeline" className="text-sm text-ivory/60 hover:text-ivory">
            ← Board
          </Link>
        </div>

        {flags.saved && (
          <p className="mb-4 rounded-lg bg-violet/10 px-3 py-2 text-sm text-violet">
            Saved.
          </p>
        )}
        {flags.error && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            Couldn&apos;t save{flags.msg ? `: ${flags.msg}` : '.'}
          </p>
        )}

        <form action={updateRecord} className="space-y-4">
          <input type="hidden" name="record_id" value={record.id} />
          <RecordFields
            config={config}
            stages={(stages ?? []) as PipelineStage[]}
            record={record}
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-violet-deep px-5 py-2.5 text-sm font-medium text-white hover:bg-violet sm:w-auto"
          >
            Save changes
          </button>
        </form>

        <div className="mt-10 border-t border-ash/60 pt-6">
          <ConfirmForm
            action={deleteRecord}
            message={`Delete ${record.company_name}? This can't be undone.`}
          >
            <input type="hidden" name="record_id" value={record.id} />
            <button
              type="submit"
              className="w-full rounded-lg border border-red-950 px-4 py-2 text-sm text-red-400 hover:border-red-400 sm:w-auto"
            >
              Delete {recordLabel(config).toLowerCase()}
            </button>
          </ConfirmForm>
        </div>
      </main>
    </div>
  )
}
