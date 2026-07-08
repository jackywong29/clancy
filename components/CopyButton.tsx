'use client'

import { useState } from 'react'

export function CopyButton({
  text,
  label = 'Copy brief',
  variant = 'primary',
}: {
  text: string
  label?: string
  variant?: 'primary' | 'outline'
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        variant === 'primary'
          ? 'rounded-lg bg-violet-deep px-5 py-2.5 text-sm font-medium text-white hover:bg-violet'
          : 'rounded-lg border border-ash px-3 py-1.5 text-sm hover:border-violet hover:text-violet'
      }
    >
      {copied ? 'Copied' : label}
    </button>
  )
}
