import { NextResponse } from 'next/server'

// TEMPORARY diagnostic route — reports only character positions/codes that
// are outside normal ASCII range, never the actual secret values. Remove
// after diagnosing the OAuth ByteString bug.
function findBadChars(value: string | undefined) {
  if (!value) return { present: false }
  const bad: { index: number; code: number }[] = []
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code > 255) {
      bad.push({ index: i, code })
    }
  }
  return {
    present: true,
    length: value.length,
    startsWith: value.slice(0, 6),
    endsWith: value.slice(-6),
    badChars: bad,
  }
}

export async function GET() {
  return NextResponse.json({
    url: findBadChars(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: findBadChars(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  })
}
