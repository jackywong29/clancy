'use client'

import { useState } from 'react'

// A colour control that supports BOTH picking and typing a hex code.
// allowEmpty=true lets the value be blank (e.g. "use theme default").
export function ColorField({
  name,
  initial,
  allowEmpty = false,
  placeholder = '#000000',
}: {
  name: string
  initial: string
  allowEmpty?: boolean
  placeholder?: string
}) {
  const [value, setValue] = useState(initial ?? '')
  const valid = /^#[0-9a-fA-F]{6}$/.test(value)
  const pickerValue = valid ? value : '#000000'

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={name} value={value} />
      <input
        type="color"
        aria-label={`${name} picker`}
        value={pickerValue}
        onChange={(e) => setValue(e.target.value)}
        className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-ash bg-graphite"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-ash bg-graphite px-3 py-2 text-sm outline-none focus:border-violet"
      />
      {allowEmpty && value && (
        <button
          type="button"
          onClick={() => setValue('')}
          className="shrink-0 text-xs text-ivory/40 hover:text-red-400"
        >
          clear
        </button>
      )}
    </div>
  )
}
