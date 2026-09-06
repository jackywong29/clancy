import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateCrmConfig } from '@/lib/actions'
import { requireWorkspaceAdmin } from '@/lib/permissions'
import { Header } from '@/components/Header'
import { CrmFieldEditor } from '@/components/CrmFieldEditor'
import { crmFields } from '@/lib/crm'
import type { CrmConfig, Organization } from '@/types/database'

const inputClass =
  'w-full rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet'

export default async function CrmConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; msg?: string }>
}) {
  const flags = await searchParams
  const orgId = (await requireWorkspaceAdmin()).orgId
  const supabase = await createClient()

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .maybeSingle()
  const org = orgRow as Organization | null

  // The Clancy workspace uses its dedicated sales board, not this editor.
  if (org?.slug === 'clancy') {
    redirect('/pipeline')
  }
  const config = (org?.crm_config ?? {}) as CrmConfig

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
        <h1 className="mb-1 text-2xl font-medium">Customize CRM</h1>
        <p className="mb-6 text-sm text-ivory/60">
          Decide what this workspace tracks — what a record is called and what
          details it holds. Stages are set on the Stages page.
        </p>

        {flags.saved && (
          <p className="mb-4 rounded-lg bg-violet/10 px-3 py-2 text-sm text-violet">
            Saved — the board updates immediately.
          </p>
        )}
        {flags.error && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            Couldn&apos;t save{flags.msg ? `: ${flags.msg}` : '.'}
          </p>
        )}

        <form action={updateCrmConfig} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="record_singular" className="mb-1 block text-sm font-medium">
                Record name (singular)
              </label>
              <input
                id="record_singular"
                name="record_singular"
                defaultValue={config.record_singular ?? ''}
                placeholder="Visitor"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="record_plural" className="mb-1 block text-sm font-medium">
                Record name (plural)
              </label>
              <input
                id="record_plural"
                name="record_plural"
                defaultValue={config.record_plural ?? ''}
                placeholder="Visitors"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Custom fields</p>
            <p className="mb-2 text-xs text-ivory/50">
              Every record already has a name, phone, email, and notes. Add
              anything specific to this business below.
            </p>
            <CrmFieldEditor
              name="fields"
              initial={JSON.stringify(crmFields(config))}
            />
          </div>

          <div>
            <label htmlFor="card_fields" className="mb-1 block text-sm font-medium">
              Show on cards
            </label>
            <p className="mb-2 text-xs text-ivory/50">
              Field keys to show on the board cards, comma-separated (e.g.
              first_visit, cell_group).
            </p>
            <input
              id="card_fields"
              name="card_fields"
              defaultValue={(config.card_fields ?? []).join(', ')}
              className={inputClass}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Modules</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-ash/60 bg-carbon p-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="module_tasks"
                  defaultChecked={config.modules?.tasks === true}
                  className="h-4 w-4 accent-violet"
                />
                Tasks
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="module_calendar"
                  defaultChecked={config.modules?.calendar === true}
                  className="h-4 w-4 accent-violet"
                />
                Calendar
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-violet-deep px-5 py-2.5 text-sm font-medium text-white hover:bg-violet"
          >
            Save CRM
          </button>
        </form>
      </main>
    </div>
  )
}
