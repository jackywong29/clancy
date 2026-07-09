import { crmFields, customValue } from '@/lib/crm'
import type { Client, CrmConfig, PipelineStage } from '@/types/database'

const inputClass =
  'w-full rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet'

// Renders the name/phone/email built-ins, all custom fields, stage, and
// notes. Used by both the add and edit forms.
export function RecordFields({
  config,
  stages,
  record,
}: {
  config: CrmConfig
  stages: PipelineStage[]
  record?: Client
}) {
  const fields = crmFields(config)
  const singular = config.record_singular || 'Record'

  return (
    <>
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          {singular} name
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={record?.company_name ?? ''}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={record?.phone ?? ''}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={record?.email ?? ''}
            className={inputClass}
          />
        </div>
      </div>

      {fields.map((field) => {
        const name = `custom.${field.key}`
        const value = customValue(record?.custom, field.key)
        return (
          <div key={field.key}>
            <label htmlFor={name} className="mb-1 block text-sm font-medium">
              {field.label}
            </label>
            {field.type === 'long' ? (
              <textarea id={name} name={name} rows={3} defaultValue={value} className={inputClass} />
            ) : field.type === 'select' ? (
              <select id={name} name={name} defaultValue={value} className={inputClass}>
                <option value="">—</option>
                {(field.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={name}
                name={name}
                type={
                  field.type === 'date'
                    ? 'date'
                    : field.type === 'number'
                      ? 'number'
                      : field.type === 'email'
                        ? 'email'
                        : 'text'
                }
                defaultValue={value}
                className={inputClass}
              />
            )}
          </div>
        )
      })}

      <div>
        <label htmlFor="stage_id" className="mb-1 block text-sm font-medium">
          Stage
        </label>
        <select
          id="stage_id"
          name="stage_id"
          defaultValue={record?.stage_id ?? ''}
          className={inputClass}
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={record?.notes ?? ''}
          className={inputClass}
        />
      </div>
    </>
  )
}
