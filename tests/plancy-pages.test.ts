import assert from 'assert'
import { readFileSync } from 'fs'
import { join } from 'path'
import { test } from './harness'
import { parseInline, parseMarkdown } from '@/lib/plancy-markdown'
import { isPublicPath } from '@/lib/public-paths'

// plancy's privacy and support pages are linked from its App Store listing.
// A reviewer or a buyer who lands on /login instead is a rejection waiting to
// happen, so the public-path rule is pinned here, along with the formatter
// that turns the plancy repo's Markdown into the pages.

test('plancy pages open without signing in', () => {
  for (const path of ['/plancy', '/plancy/privacy', '/plancy/support']) {
    assert.strictEqual(isPublicPath(path), true, path)
  }
})

test('nothing else became public with them', () => {
  for (const path of ['/plancyx', '/pipeline', '/overview', '/sites', '/home']) {
    assert.strictEqual(isPublicPath(path), false, path)
  }
  for (const path of ['/', '/login', '/s/sgckl', '/i/abc']) {
    assert.strictEqual(isPublicPath(path), true, path)
  }
})

test('markdown: headings, joined paragraphs and lists with continued items', () => {
  const blocks = parseMarkdown('# Title\n\nOne line\nwrapped.\n\n## Part\n\n- first item\n  continued\n- second\n\nAfter.')
  assert.deepStrictEqual(
    blocks.map((b) => b.kind),
    ['h1', 'p', 'h2', 'ul', 'p']
  )
  assert.deepStrictEqual(blocks[1], { kind: 'p', content: [{ text: 'One line wrapped.' }] })
  const list = blocks[3]
  assert.ok(list.kind === 'ul')
  assert.deepStrictEqual(list.items, [[{ text: 'first item continued' }], [{ text: 'second' }]])
})

test('markdown: bold and safe links only', () => {
  assert.deepStrictEqual(parseInline('email **us** at [help](mailto:a@b.c).'), [
    { text: 'email ' },
    { text: 'us', bold: true },
    { text: ' at ' },
    { text: 'help', href: 'mailto:a@b.c' },
    { text: '.' },
  ])
  assert.deepStrictEqual(parseInline('[x](javascript:alert(1))'), [{ text: 'x' }, { text: ')' }])
})

test('both plancy pages are present and read as expected', () => {
  const privacy = parseMarkdown(readFileSync(join(process.cwd(), 'content/plancy/privacy.md'), 'utf8'))
  const support = parseMarkdown(readFileSync(join(process.cwd(), 'content/plancy/support.md'), 'utf8'))
  assert.strictEqual(privacy[0].kind, 'h1')
  assert.strictEqual(support[0].kind, 'h1')
  const text = JSON.stringify(privacy) + JSON.stringify(support)
  assert.ok(text.includes('support@clancyhq.com'))
})
