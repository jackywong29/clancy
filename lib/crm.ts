import type { CrmConfig, CrmField } from '@/types/database'

// Built-in fields every record has (stored in dedicated columns, not custom).
export const BUILTIN_FIELDS = {
  name: 'company_name',
  phone: 'phone',
  email: 'email',
  notes: 'notes',
} as const

export function recordLabel(config: CrmConfig, plural = false): string {
  if (plural) return config.record_plural || 'Records'
  return config.record_singular || 'Record'
}

export function crmFields(config: CrmConfig): CrmField[] {
  return Array.isArray(config.fields) ? config.fields : []
}

export function cardFieldKeys(config: CrmConfig): string[] {
  return Array.isArray(config.card_fields) ? config.card_fields : []
}

// Value for a field key from a record, looking in custom JSON.
export function customValue(
  custom: Record<string, string> | null | undefined,
  key: string
): string {
  if (!custom) return ''
  return custom[key] ?? ''
}

export const CRM_FIELD_TYPES: { value: CrmField['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'long', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'select', label: 'Dropdown' },
]
