'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Reusable single-image upload to the public site-assets bucket.
// Path is scoped to the org + site so RLS on storage.objects passes.
export function ImageUpload({
  name,
  initial,
  orgId,
  slug,
  kind = 'image',
  label = 'image',
  className = 'h-16 w-24 rounded-lg object-cover',
}: {
  name: string
  initial: string
  orgId: string
  slug: string
  kind?: string
  label?: string
  className?: string
}) {
  const [url, setUrl] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(list: FileList | null) {
    const file = list?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${orgId}/${slug}/${kind}-${Date.now()}-${safeName}`
    const { error: uploadError } = await supabase.storage
      .from('site-assets')
      .upload(path, file)
    if (uploadError) {
      setError(uploadError.message)
    } else {
      const { data } = supabase.storage.from('site-assets').getPublicUrl(path)
      setUrl(data.publicUrl)
    }
    setBusy(false)
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={url} />
      {url && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className={className} />
          <button
            type="button"
            onClick={() => setUrl('')}
            className="text-xs text-ivory/40 hover:text-red-400"
          >
            Remove
          </button>
        </div>
      )}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ash px-3 py-1.5 text-xs text-ivory/70 hover:border-violet hover:text-violet">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleSelect(e.target.files)}
          disabled={busy}
        />
        {busy ? 'Uploading…' : url ? `Replace ${label}` : `+ Upload ${label}`}
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
