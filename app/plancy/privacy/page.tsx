import { readFileSync } from 'fs'
import { join } from 'path'
import type { Metadata } from 'next'
import { Markdown } from '../Markdown'

// The App Store's Privacy Policy URL for plancy. Read at build time.
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'plancy privacy policy',
  description: 'plancy keeps everything on your iPhone. Clancy collects nothing.',
}

export default function PlancyPrivacyPage() {
  return <Markdown source={readFileSync(join(process.cwd(), 'content/plancy/privacy.md'), 'utf8')} />
}
