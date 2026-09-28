import { redirect } from 'next/navigation'
import { getMembership } from '@/lib/permissions'

// Where you land after signing in. Client workspaces open on the Overview —
// "here's the state of your business" — while Clancy's own workspace keeps
// its sales board, which already carries its own headline numbers (MRR,
// active clients). One place decides this, so the login form, Google sign-in,
// the logo and the /login bounce can't drift apart.
export default async function HomePage() {
  const m = await getMembership()
  redirect(m.orgSlug === 'clancy' ? '/pipeline' : '/overview')
}
