import { createClient } from '@/lib/supabase/server'
import { addClient, requireOrg } from '@/lib/actions'
import { Header } from '@/components/Header'
import type { PipelineStage } from '@/types/database'

const inputClass =
  'w-full rounded-lg border border-mist bg-porcelain px-3 py-2 text-sm outline-none focus:border-violet'

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  await requireOrg()
  const supabase = await createClient()
  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('*')
    .order('position', { ascending: true })

  const stageList = (stages ?? []) as PipelineStage[]

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-medium">Add client</h1>
        <form action={addClient} className="space-y-4">
          <div>
            <label
              htmlFor="company_name"
              className="mb-1 block text-sm font-medium"
            >
              Company name
            </label>
            <input
              id="company_name"
              name="company_name"
              required
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="contact_person"
                className="mb-1 block text-sm font-medium"
              >
                Contact person
              </label>
              <input
                id="contact_person"
                name="contact_person"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium">
                Phone / WhatsApp
              </label>
              <input id="phone" name="phone" className={inputClass} />
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
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="vertical"
                className="mb-1 block text-sm font-medium"
              >
                Vertical
              </label>
              <input
                id="vertical"
                name="vertical"
                placeholder="workshop, F&B, retail…"
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="source"
                className="mb-1 block text-sm font-medium"
              >
                Source
              </label>
              <input
                id="source"
                name="source"
                placeholder="referral, IG, walk-in…"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="stage_id"
                className="mb-1 block text-sm font-medium"
              >
                Stage
              </label>
              <select id="stage_id" name="stage_id" className={inputClass}>
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
              <select id="tier" name="tier" className={inputClass}>
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
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="renewal_date"
                className="mb-1 block text-sm font-medium"
              >
                Renewal date
              </label>
              <input
                id="renewal_date"
                name="renewal_date"
                type="date"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="lock_in_start"
              className="mb-1 block text-sm font-medium"
            >
              Lock-in start
            </label>
            <input
              id="lock_in_start"
              name="lock_in_start"
              type="date"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="notes" className="mb-1 block text-sm font-medium">
              Notes
            </label>
            <textarea id="notes" name="notes" rows={4} className={inputClass} />
          </div>
          {params.error && (
            <p className="text-sm text-red-600">
              Couldn&apos;t save the client. Check the fields and try again.
            </p>
          )}
          <button
            type="submit"
            className="rounded-lg bg-violet-deep px-5 py-2.5 text-sm font-medium text-white hover:bg-violet"
          >
            Save client
          </button>
        </form>
      </main>
    </div>
  )
}
