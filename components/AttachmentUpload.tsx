'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBytes, isImage } from '@/lib/broadcast-email'
import type { BroadcastAttachment } from '@/types/database'

// Files are uploaded before the broadcast row exists, so they land under a
// draft id and the resolved paths ride to the server in a hidden input as
// JSON — the same shape the site editor uses for images.
//
// The bucket is private, so thumbnails here come from a local object URL
// rather than a public URL. Nothing about these files is world-readable.

const MAX_TOTAL_BYTES = 18 * 1024 * 1024

export function AttachmentUpload({
  name,
  orgId,
}: {
  name: string
  orgId: string
}) {
  const [draftId] = useState(() => crypto.randomUUID())
  const [files, setFiles] = useState<BroadcastAttachment[]>([])
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const total = files.reduce((sum, f) => sum + f.size, 0)

  // Object URLs leak until revoked.
  useEffect(() => {
    return () => {
      Object.values(previews).forEach((url) => URL.revokeObjectURL(url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function upload(list: FileList | File[] | null) {
    const picked = list ? Array.from(list) : []
    if (picked.length === 0) return
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const added: BroadcastAttachment[] = []
    const addedPreviews: Record<string, string> = {}
    let running = total

    for (const file of picked) {
      if (running + file.size > MAX_TOTAL_BYTES) {
        setError(
          `${file.name} would push this email past ${formatBytes(MAX_TOTAL_BYTES)} — email providers reject anything bigger. Send it as a link instead.`
        )
        break
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${orgId}/${draftId}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('broadcast-files')
        .upload(path, file)
      if (uploadError) {
        setError(uploadError.message)
        break
      }
      const type = file.type || 'application/octet-stream'
      added.push({
        name: file.name,
        path,
        size: file.size,
        type,
        // Images default to showing in the message body — that's what people
        // mean by "attach a photo" to a newsletter.
        inline: isImage(type),
      })
      if (isImage(type)) addedPreviews[path] = URL.createObjectURL(file)
      running += file.size
    }

    if (added.length) {
      setFiles((prev) => [...prev, ...added])
      setPreviews((prev) => ({ ...prev, ...addedPreviews }))
    }
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function remove(path: string) {
    setFiles((prev) => prev.filter((f) => f.path !== path))
    setPreviews((prev) => {
      if (prev[path]) URL.revokeObjectURL(prev[path])
      const next = { ...prev }
      delete next[path]
      return next
    })
    // The uploaded object is left in the bucket — harmless, private, and
    // cheaper than a delete that could race the send.
  }

  function toggleInline(path: string) {
    setFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, inline: !f.inline } : f))
    )
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(files)} />

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f) => (
            <div
              key={f.path}
              className="flex items-center gap-3 rounded-lg border border-ash/60 bg-graphite/60 px-3 py-2"
            >
              {previews[f.path] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previews[f.path]}
                  alt={f.name}
                  className="h-10 w-10 shrink-0 rounded object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-ash/40 text-xs text-ivory/50">
                  {(f.name.split('.').pop() ?? 'file').slice(0, 4).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{f.name}</p>
                <p className="text-xs text-ivory/50">{formatBytes(f.size)}</p>
              </div>
              {isImage(f.type) && (
                <button
                  type="button"
                  onClick={() => toggleInline(f.path)}
                  className={`shrink-0 rounded px-2 py-2 text-xs sm:py-1 ${
                    f.inline
                      ? 'bg-violet/15 text-violet'
                      : 'border border-ash text-ivory/60 hover:text-ivory'
                  }`}
                  title={
                    f.inline
                      ? 'Shown inside the message'
                      : 'Sent as a downloadable attachment'
                  }
                >
                  {f.inline ? 'In message' : 'Attached'}
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(f.path)}
                aria-label={`Remove ${f.name}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-ivory/40 hover:text-red-400 sm:h-6 sm:w-6"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          upload(e.dataTransfer.files)
        }}
        className={`flex cursor-pointer items-center justify-center rounded-lg border border-dashed px-3 py-3 text-xs ${
          dragging
            ? 'border-violet text-violet'
            : 'border-ash text-ivory/60 hover:border-violet hover:text-violet'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => upload(e.target.files)}
          disabled={busy}
        />
        {busy
          ? 'Uploading…'
          : files.length > 0
            ? `+ Add more · ${formatBytes(total)} of ${formatBytes(MAX_TOTAL_BYTES)}`
            : 'Attach files or images — click or drop them here'}
      </label>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
