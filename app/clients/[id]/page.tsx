import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateClient, deleteClient, requireOrg } from '@/lib/actions'
import { Header } from '@/components/Header'
import { ClientTabs } from '@/components/ClientTabs'
import { ConfirmForm } from '@/components/ConfirmForm'
import type { Client, PipelineStage } from '@/types/database'

const inputClass =
  'w-full rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet'

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; error?: string; msg?: string }>
}) {
  const { id } = await params
  const flags = await searchParams
  await requireOrg()
  const supabase = await createClient()

  const [{ data: clientRow }, { data: stages }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('pipeline_stages')
      .select('*')
      .order('position', { ascending: true }),
  ])

  if (!clientRow) {
    notFound()
  }
  const client = clientRow as Client
  const stageList = (stages ?? []) as PipelineStage[]

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="mb-1 text-2xl font-medium">{client.company_name}</h1>
        <p className="mb-6 text-sm text-ivory/60">
          Added {client.created_at.slice(0, 10)}
        </p>
        <ClientTabs clientId={client.id} active="details" />
        {flags.saved && (
          <p className="mb-4 rounded-lg bg-violet/10 px-3 py-2 text-sm text-violet">
            Saved.
          </p>
        )}
        {flags.error && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            Couldn&apos;t save{flags.msg ? `: ${flags.msg}` : '. Check the fields and try again.'}
          </p>
        )}
        <form action={updateClient} className="space-y-4">
          <input type="hidden" name="client_id" value={client.id} />
          <div>
            <label htmlFor="company_name" className="mb-1 block text-sm font-medium">
              Company name
            </label>
            <input
              id="company_name"
              name="company_name"
              required
              defaultValue={client.company_name}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="contact_person" className="mb-1 block text-sm font-medium">
                Contact person
              </label>
              <input
                id="contact_person"
                name="contact_person"
                defaultValue={client.contact_person ?? ''}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium">
                Phone / WhatsApp
              </label>
              <input
                id="phone"
                name="phone"
                defaultValue={client.phone ?? ''}
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={client.email ?? ''}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="vertical" className="mb-1 block text-sm font-medium">
                Vertical
              </label>
              <input
                id="vertical"
                name="vertical"
                defaultValue={client.vertical ?? ''}
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="source" className="mb-1 block text-sm font-medium">
                Source
              </label>
              <input
                id="source"
                name="source"
                defaultValue={client.source ?? ''}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="stage_id" className="mb-1 block text-sm font-medium">
                Stage
              </label>
              <select
                id="stage_id"
                name="stage_id"
                defaultValue={client.stage_id ?? ''}
                className={inputClass}
              >
                {stageList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="tier" className="mb-1 block text-sm font-medium">
                Tier
              </label>
              <select
                id="tier"
                name="tier"
                defaultValue={client.tier ?? ''}
                className={inputClass}
              >
                <option value="">—</option>
                <option value="managed">Managed</option>
                <option value="self-serve">Self-serve</option>
                <option value="pilot">Pilot (50% off)</option>
              </select>
            </div>
            <div>
              <label htmlFor="mrr" className="mb-1 block text-sm font-medium">
                MRR (RM)
              </label>
              <input
                id="mrr"
                name="mrr"
                type="number"
                min="0"
                step="1"
                defaultValue={client.mrr ?? ''}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="renewal_date" className="mb-1 block text-sm font-medium">
                Renewal date
              </label>
              <input
                id="renewal_date"
                name="renewal_date"
                type="date"
                defaultValue={client.renewal_date ?? ''}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="lock_in_start" className="mb-1 block text-sm font-medium">
              Lock-in start
            </label>
            <input
              id="lock_in_start"
              name="lock_in_start"
              type="date"
              defaultValue={client.lock_in_start ?? ''}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="notes" className="mb-1 block text-sm font-medium">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={client.notes ?? ''}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-violet-deep px-5 py-2.5 text-sm font-medium text-white hover:bg-violet"
          >
            Save changes
          </button>
        </form>
        <div className="mt-10 border-t border-ash/60 pt-6">
          <ConfirmForm
            action={deleteClient}
            message={`Delete ${client.company_name} and their intake data? This can't be undone.`}
          >
            <input type="hidden" name="client_id" value={client.id} />
            <button
              type="submit"
              className="rounded-lg border border-red-950 px-4 py-2 text-sm text-red-400 hover:border-red-400"
            >
              Delete client
            </button>
          </ConfirmForm>
        </div>
      </main>
    </div>
  )
}
