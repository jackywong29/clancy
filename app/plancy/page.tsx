import { redirect } from 'next/navigation'

// No plancy home page yet; the bare address goes to support.
export default function PlancyIndex() {
  redirect('/plancy/support')
}
