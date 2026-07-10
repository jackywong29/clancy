import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOrg } from '@/lib/actions'
import { Header } from '@/components/Header'
import { ClientTabs } from '@/components/ClientTabs'
import { CopyButton } from '@/components/CopyButton'
import { buildCrmBrief, type IntakeData } from '@/lib/intake'
import type { Client, CrmConfig, Intake, Organization } from '@/types/database'

export default async function CrmBriefPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const orgId = await requireOrg()
  const supabase = await createClient()

  const [{ data: clientRow }, { data: intakeRow }, { data: orgRow }] =
    await Promise.all([
      supabase.from('clients').select('*').eq('id', id).maybeSingle(),
      supabase.from('intakes').select('*').eq('client_id', id).maybeSingle(),
      supabase
        .from('organizations')
        .select('crm_config')
        .eq('id', orgId)
        .maybeSingle(),
    ])

  if (!clientRow) {
    notFound()
  }
  const client = clientRow as Client
  const data: IntakeData = (intakeRow as Intake | null)?.data ?? {}
  const config = ((orgRow as Pick<Organization, 'crm_config'> | null)
    ?.crm_config ?? {}) as CrmConfig
  const brief = buildCrmBrief(client, data, config)

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="mb-1 text-2xl font-medium">{client.company_name}</h1>
        <p className="mb-6 text-sm text-ivory/60">CRM build brief</p>
        <ClientTabs clientId={client.id} active="crm-brief" />

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-ivory/60">
            Configures the client&apos;s internal back-end (records, stages,
            departments).
          </p>
          <CopyButton text={brief} label="Copy CRM brief" />
        </div>

        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-ash/60 bg-carbon p-5 font-mono text-xs leading-relaxed">
          {brief}
        </pre>

        <p className="mt-4 text-xs text-ivory/50">
          Two briefs, one intake: the Website brief builds their public site,
          this one builds their CRM. Hand it to Claude with &quot;set up the
          CRM for {client.company_name}&quot;.
        </p>
      </main>
    </div>
  )
}
