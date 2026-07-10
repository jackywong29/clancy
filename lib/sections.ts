// The reorderable body sections of a client site. Hero is pinned at the top
// and the footer at the bottom, so only these move. Order + on/off is stored
// in config.section_order (an ordered list of the enabled keys); absent =
// DEFAULT_SECTION_ORDER (the original layout), so existing sites are unchanged.

export const SECTION_KEYS = [
  'about',
  'services',
  'gallery',
  'find_us',
  'faq',
  'form',
] as const

export type SectionKey = (typeof SECTION_KEYS)[number]

export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  'about',
  'services',
  'gallery',
  'find_us',
  'faq',
  'form',
]

export const SECTION_LABELS: Record<SectionKey, string> = {
  about: 'About',
  services: 'Services',
  gallery: 'Photo gallery',
  find_us: 'Find us',
  faq: 'FAQ',
  form: 'Signup form',
}

function isSectionKey(k: string): k is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(k)
}

export function isCustomSectionKey(k: string): boolean {
  return k.startsWith('custom-')
}

// Resolve the stored order into a clean, de-duped list of valid keys.
// Built-in keys plus any 'custom-*' keys present in customKeys survive.
// Newly added custom sections not yet in the saved order are appended.
export function resolveSectionOrder(
  order?: string[],
  customKeys: string[] = []
): string[] {
  if (!order || order.length === 0) {
    return [...DEFAULT_SECTION_ORDER, ...customKeys]
  }
  const seen = new Set<string>()
  for (const k of order) {
    if (isSectionKey(k) || customKeys.includes(k)) seen.add(k)
  }
  for (const k of customKeys) {
    if (!seen.has(k)) seen.add(k)
  }
  return seen.size ? [...seen] : [...DEFAULT_SECTION_ORDER, ...customKeys]
}
