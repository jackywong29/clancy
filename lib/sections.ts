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
] as const

export type SectionKey = (typeof SECTION_KEYS)[number]

export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  'about',
  'services',
  'gallery',
  'find_us',
  'faq',
]

export const SECTION_LABELS: Record<SectionKey, string> = {
  about: 'About',
  services: 'Services',
  gallery: 'Photo gallery',
  find_us: 'Find us',
  faq: 'FAQ',
}

function isSectionKey(k: string): k is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(k)
}

// Resolve the stored order into a clean, de-duped list of valid keys.
// Empty/absent → the default order (all sections, original layout).
export function resolveSectionOrder(order?: string[]): SectionKey[] {
  if (!order || order.length === 0) return DEFAULT_SECTION_ORDER
  const seen = new Set<SectionKey>()
  for (const k of order) {
    if (isSectionKey(k)) seen.add(k)
  }
  return seen.size ? [...seen] : DEFAULT_SECTION_ORDER
}
