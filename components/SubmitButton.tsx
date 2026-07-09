'use client'

import { useFormStatus } from 'react-dom'

// Submit button that reflects the form's pending state instantly on click —
// disables + swaps to pendingText so the action feels acknowledged even while
// the server action runs. Drop-in replacement for <button type="submit">.
export function SubmitButton({
  children,
  className,
  pendingText = 'Saving…',
}: {
  children: React.ReactNode
  className?: string
  pendingText?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className ?? ''} disabled:opacity-70`}
    >
      {pending ? pendingText : children}
    </button>
  )
}
