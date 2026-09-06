import { redirect } from 'next/navigation'

// /stages became /workflow — the pipeline and its checklists are now edited
// on one screen. Kept as a redirect so old links and bookmarks still land.
export default function StagesPage() {
  redirect('/workflow')
}
