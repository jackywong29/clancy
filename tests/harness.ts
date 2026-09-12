// Minimal test harness. Deliberately dependency-free: the app targets Node 20+
// (where `node --test` could run these directly), but this runs anywhere Node
// runs, including older machines, and adds nothing to the Vercel build.

type TestFn = () => void | Promise<void>

const cases: { name: string; fn: TestFn }[] = []

export function test(name: string, fn: TestFn): void {
  cases.push({ name, fn })
}

export async function run(): Promise<void> {
  let failed = 0
  for (const c of cases) {
    try {
      await c.fn()
      console.log(`  ok    ${c.name}`)
    } catch (err) {
      failed += 1
      console.log(`  FAIL  ${c.name}`)
      const detail = err instanceof Error ? (err.stack ?? err.message) : String(err)
      console.log(
        detail
          .split('\n')
          .slice(0, 8)
          .map((l) => `          ${l}`)
          .join('\n')
      )
    }
  }
  console.log(
    `\n${cases.length - failed} passed, ${failed} failed (${cases.length} total)`
  )
  if (failed > 0) process.exitCode = 1
}
