import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOrg } from '@/lib/actions'
import { Header } from '@/components/Header'
import { ClientTabs } from '@/components/ClientTabs'
import { CopyButton } from '@/components/CopyButton'
import {
  buildWorkflowBrief,
  parseWorkflowSteps,
  type IntakeData,
} from '@/lib/intake'
import type { Client, CrmConfig, Intake, Organization } from '@/types/database'

export default async function WorkflowBriefPage({
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
  const brief = buildWorkflowBrief(client, data, config)

  const steps = parseWorkflowSteps(data['workflow.pipeline_steps'])
  const withDetail = steps.filter(
    (s) => s.tasks || s.who || s.duration || s.blocker || s.automatic
  ).length

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="mb-1 text-2xl font-medium">{client.company_name}</h1>
        <p className="mb-6 text-sm text-ivory/60">Workflow build brief</p>
        <ClientTabs clientId={client.id} active="workflow-brief" />

        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-sm text-ivory/60">
            Configures their <strong className="text-ivory/80">process</strong>{' '}
            — pipeline stages and the checklist that fires at each one.
          </p>
          <CopyButton text={brief} label="Copy workflow brief" />
        </div>

        {steps.length === 0 ? (
          <p className="mb-4 rounded-lg bg-amber-950/30 px-3 py-2 text-sm text-amber-300">
            No process captured yet. Fill{' '}
            <strong>Workflow mapping → Your process, step by step</strong> on
            the Intake tab, or send the client their intake link and let them
            describe it themselves.
          </p>
        ) : (
          withDetail < steps.length && (
            <p className="mb-4 rounded-lg bg-ash/30 px-3 py-2 text-sm text-ivory/70">
              {withDetail} of {steps.length} step
              {steps.length === 1 ? '' : 's'} have detail. The brief still
              works — stages without detail just get no checklist. Adding
              &ldquo;what has to happen here&rdquo; is what makes them useful.
            </p>
          )
        )}

        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-ash/60 bg-carbon p-4 font-mono text-xs leading-relaxed sm:p-5">
          {brief}
        </pre>

        <p className="mt-4 text-xs text-ivory/50">
          Three briefs, one intake: Website builds their public site, CRM builds
          the shape of their workspace, this one builds the process inside it.
          Hand it to Claude with &quot;build the workflow for{' '}
          {client.company_name}&quot;.
        </p>
      </main>
    </div>
  )
}
