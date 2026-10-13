// The little Markdown that plancy's legal pages use: # and ## headings,
// paragraphs (hard-wrapped lines are joined), "- " lists (an indented line
// continues the item), **bold** and [text](url) links. The files come from the
// plancy repo (`node scripts/legal-pages.mjs` there copies them into
// content/plancy/). Anything else renders as plain text. Pure, so it's tested.

export type Inline = { text: string; bold?: boolean; href?: string }

export type Block =
  | { kind: 'h1' | 'h2' | 'p'; content: Inline[] }
  | { kind: 'ul'; items: Inline[][] }

// Only links that can't run script: a javascript: link renders as its text.
const SAFE_HREF = /^(https:\/\/|mailto:)/

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of text.matchAll(/\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    const at = m.index ?? 0
    if (at > last) out.push({ text: text.slice(last, at) })
    if (m[1] !== undefined) out.push({ text: m[1], bold: true })
    else if (SAFE_HREF.test(m[3])) out.push({ text: m[2], href: m[3] })
    else out.push({ text: m[2] })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  let list: string[][] | null = null

  const flush = () => {
    if (para.length > 0) blocks.push({ kind: 'p', content: parseInline(para.join(' ')) })
    if (list) blocks.push({ kind: 'ul', items: list.map((lines) => parseInline(lines.join(' '))) })
    para = []
    list = null
  }

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '') {
      flush()
      continue
    }
    const heading = line.match(/^(#{1,2}) (.+)$/)
    if (heading) {
      flush()
      blocks.push({ kind: heading[1].length === 1 ? 'h1' : 'h2', content: parseInline(heading[2]) })
      continue
    }
    if (line.startsWith('- ')) {
      if (para.length > 0) flush()
      list = list ?? []
      list.push([line.slice(2)])
      continue
    }
    if (list && /^\s/.test(raw)) {
      list[list.length - 1].push(line)
      continue
    }
    if (list) flush()
    para.push(line)
  }
  flush()
  return blocks
}
