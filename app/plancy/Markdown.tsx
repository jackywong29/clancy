import { Fragment } from 'react'
import { parseMarkdown, type Inline } from '@/lib/plancy-markdown'

function Inlines({ parts }: { parts: Inline[] }) {
  return parts.map((part, i) =>
    part.href ? (
      <a key={i} href={part.href}>
        {part.text}
      </a>
    ) : part.bold ? (
      <strong key={i}>{part.text}</strong>
    ) : (
      <Fragment key={i}>{part.text}</Fragment>
    )
  )
}

// Renders the parsed blocks as elements; no raw HTML ever reaches the page.
export function Markdown({ source }: { source: string }) {
  return parseMarkdown(source).map((block, i) => {
    if (block.kind === 'ul') {
      return (
        <ul key={i}>
          {block.items.map((item, j) => (
            <li key={j}>
              <Inlines parts={item} />
            </li>
          ))}
        </ul>
      )
    }
    const Tag = block.kind
    return (
      <Tag key={i}>
        <Inlines parts={block.content} />
      </Tag>
    )
  })
}
