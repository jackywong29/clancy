import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { submitClientIntake } from '@/lib/actions'
import { ServiceListEditor } from '@/components/intake/ServiceListEditor'
import { CLIENT_FACING_SECTIONS, type IntakeData } from '@/lib/intake'

const inputClass =
  'w-full rounded-lg border border-[#221F1A]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#5646E5]'

export default async function ClientIntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const { token } = await params
  const flags = await searchParams
  const supabase = await createClient()

  const { data: result } = await supabase.rpc('intake_by_token', { t: token })
  if (!result) notFound()

  const companyName = result.company_name as string
  const data = (result.data ?? {}) as IntakeData

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#221F1A]">
      <main className="mx-auto max-w-xl px-6 py-10">
        <p className="text-sm font-medium text-[#5646E5]">clancy.</p>
        <h1 className="mt-2 text-2xl font-medium">
          {companyName} — tell us about your business
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#221F1A]/60">
          This takes about 10 minutes and everything is editable later. The
          more you fill in, the faster your website and booking system go
          live. Your answers save when you press the button at the bottom.
        </p>

        {flags.saved && (
          <p className="mt-4 rounded-lg bg-[#5646E5]/10 px-3 py-2 text-sm font-medium text-[#5646E5]">
            Saved — thank you! You can close this page, or keep editing and
            save again.
          </p>
        )}
        {flags.error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            Something went wrong saving. Try again, or WhatsApp us your
            answers instead.
          </p>
        )}

        <form action={submitClientIntake} className="mt-8 space-y-8">
          <input type="hidden" name="token" value={token} />
          {CLIENT_FACING_SECTIONS.map((section, i) => (
            <section key={section.key}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-medium">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5646E5]/10 text-xs font-medium text-[#5646E5]">
                  {i + 1}
                </span>
                {section.title}
              </h2>
              <div className="space-y-4">
                {section.fields.map((field) => {
                  const name = `${section.key}.${field.key}`
                  const value = data[name] ?? ''
                  return (
                    <div key={name}>
                      <label htmlFor={name} className="mb-1 block text-sm">
                        {field.label}
                      </label>
                      {field.type === 'services' ? (
                        <div className="rounded-xl border border-[#221F1A]/10 bg-white p-3 [&_input]:border-[#221F1A]/15 [&_input]:bg-[#FAF8F3] [&_input]:text-[#221F1A] [&_.text-ivory\/50]:text-[#221F1A]/50 [&_.text-ivory\/70]:text-[#221F1A]/70 [&_.text-ivory\/40]:text-[#221F1A]/40 [&_button]:border-[#221F1A]/20 [&_button]:text-[#221F1A]/70">
                        <ServiceListEditor name={name} initial={value} />
                        </div>
                      ) : field.type === 'long' ? (
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
              className="w-full rounded-lg bg-[#5646E5] px-5 py-3 text-sm font-medium text-white hover:opacity-90"
            >
              Save my answers
            </button>
          </div>
        </form>
        <p className="mt-8 text-center text-xs text-[#221F1A]/40">
          Powered by clancy. · your answers go only to your Clancy manager
        </p>
      </main>
    </div>
  )
}
