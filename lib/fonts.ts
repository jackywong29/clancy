// Curated web fonts for client sites. Each maps to a Google Fonts family
// (loaded via a stylesheet link on the public site) and a CSS stack.
// 'custom' lets an admin type any Google Font name (config.font_custom).

export interface FontDef {
  key: string
  label: string
  google: string // Google Fonts family name (spaces kept)
  stack: string // CSS font-family value
}

export const FONTS: FontDef[] = [
  {
    key: 'sans',
    label: 'Modern Sans (Inter)',
    google: 'Inter',
    stack: "'Inter', system-ui, sans-serif",
  },
  {
    key: 'grotesk',
    label: 'Grotesk (Space Grotesk)',
    google: 'Space Grotesk',
    stack: "'Space Grotesk', system-ui, sans-serif",
  },
  {
    key: 'serif',
    label: 'Classic Serif (Lora)',
    google: 'Lora',
    stack: "'Lora', Georgia, serif",
  },
  {
    key: 'display',
    label: 'Elegant Display (Playfair Display)',
    google: 'Playfair Display',
    stack: "'Playfair Display', Georgia, serif",
  },
  {
    key: 'rounded',
    label: 'Friendly Rounded (Nunito)',
    google: 'Nunito',
    stack: "'Nunito', system-ui, sans-serif",
  },
  {
    key: 'mono',
    label: 'Mono (JetBrains Mono)',
    google: 'JetBrains Mono',
    stack: "'JetBrains Mono', ui-monospace, monospace",
  },
]

const DEFAULT_STACK = "'Inter', system-ui, sans-serif"

// Resolve a site's font config into a Google Fonts family to load and a
// CSS font-family stack to apply. Falls back to the default sans.
export function resolveFont(font?: string, custom?: string): {
  google: string
  stack: string
} {
  if (font === 'custom' && custom?.trim()) {
    const family = custom.trim()
    return { google: family, stack: `'${family}', system-ui, sans-serif` }
  }
  const def = FONTS.find((f) => f.key === font)
  if (def) return { google: def.google, stack: def.stack }
  return { google: 'Inter', stack: DEFAULT_STACK }
}

// Build the Google Fonts stylesheet URL for a family (a few common weights).
export function googleFontHref(family: string): string {
  return googleFontsHref([family])
}

// Combined stylesheet URL for several families in one request (deduped).
export function googleFontsHref(families: string[]): string {
  const uniq = Array.from(new Set(families.filter(Boolean)))
  const spec = uniq
    .map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`)
    .join('&')
  return `https://fonts.googleapis.com/css2?${spec}&display=swap`
}

// Resolve a per-type font: a curated FONTS key, or inherit the global stack.
export function typeFont(
  key: string | undefined,
  globalStack: string
): { stack: string; google: string | null } {
  if (key) {
    const def = FONTS.find((f) => f.key === key)
    if (def) return { stack: def.stack, google: def.google }
  }
  return { stack: globalStack, google: null }
}
