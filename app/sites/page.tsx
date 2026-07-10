import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createSite, requireAdmin } from '@/lib/actions'
import { Header } from '@/components/Header'
import { SubmitButton } from '@/components/SubmitButton'
import type { Organization, Site } from '@/types/database'

const inputClass =
  'rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet'

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; msg?: string }>
}) {
  const flags = await searchParams
  await requireAdmin()
  const supabase = await createClient()

  const [{ data: sites }, { data: orgs }] = await Promise.all([
    supabase.from('sites').select('*').order('created_at', { ascending: true }),
    supabase.from('organizations').select('*').order('name'),
  ])

  const siteList = ((sites ?? []) as Site[]).filter(
    (s) => s.slug !== 'clancy-home'
  )
  const orgList = (orgs ?? []) as Organization[]
  const orgName = (id: string) => orgList.find((o) => o.id === id)?.name ?? '—'

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="mb-1 text-2xl font-medium">Client websites</h1>
        <p className="mb-6 text-sm text-ivory/60">
          Each site renders at /s/&lt;slug&gt; from its config — no code per
          client, ever.
        </p>
        {flags.error && (
          <p className="mb-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">
            {flags.msg ?? 'Something went wrong.'}
          </p>
        )}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-violet/40 bg-carbon p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              Clancy homepage
              <span className="ml-2 rounded bg-violet/10 px-1.5 py-0.5 text-xs font-normal text-violet">
                yours
              </span>
            </p>
            <p className="text-xs text-ivory/60">
              clancy-hq.vercel.app — what new prospects land on
            </p>
          </div>
          <a
            href="/"
            target="_blank"
            className="text-sm text-ivory/60 hover:text-ivory"
          >
            View
          </a>
          <Link
            href="/sites/home/edit"
            className="rounded-lg border border-ash px-3 py-1.5 text-sm hover:border-violet hover:text-violet"
          >
            Edit
          </Link>
        </div>

        <div className="space-y-2">
          {siteList.map((site) => (
            <div
              key={site.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-ash/60 bg-carbon p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {site.config.name ?? site.slug}
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-xs font-normal ${
                      site.published
                        ? 'bg-violet/10 text-violet'
                        : 'bg-ash/40 text-ivory/50'
                    }`}
                  >
                    {site.published ? 'live' : 'draft'}
                  </span>
                </p>
                <p className="text-xs text-ivory/60">
                  /s/{site.slug} · {orgName(site.organization_id)}
                </p>
              </div>
              {site.published && (
                <a
                  href={`/s/${site.slug}`}
                  target="_blank"
                  className="text-sm text-ivory/60 hover:text-ivory"
                >
                  View
                </a>
              )}
              <Link
                href={`/sites/${site.slug}/edit`}
                className="rounded-lg border border-ash px-3 py-1.5 text-sm hover:border-violet hover:text-violet"
              >
                Edit
              </Link>
            </div>
          ))}
          {siteList.length === 0 && (
            <p className="rounded-xl border border-dashed border-ash bg-carbon/50 p-6 text-center text-sm text-ivory/60">
              No sites yet — create the first one below.
            </p>
          )}
        </div>
        <form
          action={createSite}
          className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-ash bg-carbon/50 p-3"
        >
          <select
            name="organization_id"
            required
            className={inputClass}
            aria-label="Workspace"
          >
            {orgList.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <input
            name="slug"
            required
            placeholder="slug (e.g. ace-motors)"
            className={`${inputClass} flex-1`}
          />
          <input
            name="name"
            placeholder="Business name"
            className={`${inputClass} flex-1`}
          />
          <SubmitButton
            pendingText="Creating…"
            className="rounded-lg bg-violet-deep px-4 py-2 text-sm font-medium text-white hover:bg-violet"
          >
            Create site
          </SubmitButton>
        </form>
      </main>
    </div>
  )
}
