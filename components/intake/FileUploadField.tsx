'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UploadedFile } from '@/lib/intake'

function parse(initial: string): UploadedFile[] {
  try {
    const files = JSON.parse(initial)
    if (Array.isArray(files)) return files
  } catch {
    // fall through to default
  }
  return []
}

export function FileUploadField({
  name,
  initial,
  orgId,
  clientId,
  fieldKey,
}: {
  name: string
  initial: string
  orgId: string
  clientId: string
  fieldKey: string
}) {
  const [files, setFiles] = useState<UploadedFile[]>(() => parse(initial))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSelect(list: FileList | null) {
    if (!list || list.length === 0) return
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const added: UploadedFile[] = []

    for (const file of Array.from(list)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${orgId}/${clientId}/${fieldKey}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('intake-files')
        .upload(path, file)
      if (uploadError) {
        setError(`Upload failed for ${file.name}: ${uploadError.message}`)
      } else {
        added.push({ path, name: file.name })
      }
    }

    setFiles((prev) => [...prev, ...added])
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function view(file: UploadedFile) {
    const supabase = createClient()
    const { data } = await supabase.storage
      .from('intake-files')
      .createSignedUrl(file.path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function remove(file: UploadedFile) {
    const supabase = createClient()
    await supabase.storage.from('intake-files').remove([file.path])
    setFiles((prev) => prev.filter((f) => f.path !== file.path))
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(files)} />
      {files.map((file) => (
        <div
          key={file.path}
          className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-ash/60 bg-carbon/50 px-3 py-2 text-sm sm:py-1.5"
        >
          <span className="min-w-0 flex-1 break-all">{file.name}</span>
          <button
            type="button"
            onClick={() => view(file)}
            className="text-xs text-violet hover:underline"
          >
            View
          </button>
          <button
            type="button"
            onClick={() => remove(file)}
            aria-label={`Remove ${file.name}`}
            className="text-ivory/40 hover:text-red-400"
          >
            ×
          </button>
        </div>
      ))}
      <label className="inline-flex max-w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ash px-3 py-2 text-xs text-ivory/70 hover:border-violet hover:text-violet sm:py-1.5">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleSelect(e.target.files)}
          disabled={busy}
        />
        {busy ? 'Uploading…' : '+ Upload files'}
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
