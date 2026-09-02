'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function parse(initial: string): string[] {
  try {
    const rows = JSON.parse(initial)
    if (Array.isArray(rows)) return rows.filter((r) => typeof r === 'string')
  } catch {
    // fall through
  }
  return []
}

// Multi-image upload for a photo gallery. Stores an ordered array of public
// URLs in a hidden input as JSON; uploads to the org/site-scoped path.
export function GalleryUpload({
  name,
  initial,
  orgId,
  slug,
}: {
  name: string
  initial: string
  orgId: string
  slug: string
}) {
  const [urls, setUrls] = useState<string[]>(() => parse(initial))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(list: FileList | null) {
    const files = list ? Array.from(list) : []
    if (files.length === 0) return
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const added: string[] = []
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${orgId}/${slug}/gallery-${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('site-assets')
        .upload(path, file)
      if (uploadError) {
        setError(uploadError.message)
        break
      }
      const { data } = supabase.storage.from('site-assets').getPublicUrl(path)
      added.push(data.publicUrl)
    }
    if (added.length) setUrls((prev) => [...prev, ...added])
    setBusy(false)
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(urls)} />
      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {urls.map((u, i) => (
            <div key={u} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u}
                alt={`Photo ${i + 1}`}
                className="aspect-square w-full rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => setUrls(urls.filter((_, idx) => idx !== i))}
                aria-label="Remove photo"
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-xs text-white sm:h-5 sm:w-5 sm:opacity-0 sm:group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="inline-flex max-w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ash px-3 py-2 text-xs text-ivory/70 hover:border-violet hover:text-violet sm:py-1.5">
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleSelect(e.target.files)}
          disabled={busy}
        />
        {busy ? 'Uploading…' : '+ Add photos'}
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
