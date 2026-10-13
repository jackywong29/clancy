import { readFileSync } from 'fs'
import { join } from 'path'
import type { Metadata } from 'next'
import { Markdown } from '../Markdown'

// The App Store's Support URL for plancy. Read at build time.
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'plancy support',
  description: 'Help with plancy, the daily planner for iPhone, and how to reach us.',
}

export default function PlancySupportPage() {
  return <Markdown source={readFileSync(join(process.cwd(), 'content/plancy/support.md'), 'utf8')} />
}
