import type { SupabaseClient } from '@supabase/supabase-js'

// A fake PostgREST client: enough of the builder to exercise the checklist
// queries (.from().select().eq().neq() awaited, and .insert()) without a
// database. Filters are applied for real so a test can prove that
// generateStageTasks scopes its idempotency check to the right stage.

type Row = Record<string, unknown>
type Filter = { op: 'eq' | 'neq'; column: string; value: unknown }

export interface FakeOptions {
  /** Rows the fake returns from `.from('tasks')` before any filtering. */
  tasks?: Row[]
  /** Make the existing-tasks read fail. */
  readError?: string
  /** Make the insert fail. */
  insertError?: string
}

export interface FakeSupabase {
  client: SupabaseClient<unknown>
  /** Every batch handed to `.insert()`, in order. */
  inserted: Row[][]
  /** Filters seen per table, for asserting query scoping. */
  filters: Record<string, Filter[]>
}

export function fakeSupabase(options: FakeOptions = {}): FakeSupabase {
  const inserted: Row[][] = []
  const filters: Record<string, Filter[]> = {}

  const client = {
    from(table: string) {
      // Filters are per-builder for row matching, but recorded cumulatively:
      // a single call can open the same table twice (read, then insert).
      const applied: Filter[] = []
      const seen = filters[table] || (filters[table] = [])

      const rows = (): Row[] => {
        const source = table === 'tasks' ? (options.tasks ?? []) : []
        return source.filter((row) =>
          applied.every((f) =>
            f.op === 'eq' ? row[f.column] === f.value : row[f.column] !== f.value
          )
        )
      }

      const builder = {
        select: () => builder,
        order: () => builder,
        not: () => builder,
        limit: () => builder,
        eq(column: string, value: unknown) {
          const filter: Filter = { op: 'eq', column, value }
          applied.push(filter)
          seen.push(filter)
          return builder
        },
        neq(column: string, value: unknown) {
          const filter: Filter = { op: 'neq', column, value }
          applied.push(filter)
          seen.push(filter)
          return builder
        },
        insert(payload: Row | Row[]) {
          inserted.push(Array.isArray(payload) ? payload : [payload])
          return Promise.resolve({
            data: null,
            error: options.insertError ? { message: options.insertError } : null,
          })
        },
        then<T>(
          resolve: (value: { data: Row[] | null; error: { message: string } | null }) => T,
          reject?: (reason: unknown) => T
        ) {
          const result = options.readError
            ? { data: null, error: { message: options.readError } }
            : { data: rows(), error: null }
          return Promise.resolve(result).then(resolve, reject)
        },
      }

      return builder
    },
  }

  return {
    client: client as unknown as SupabaseClient<unknown>,
    inserted,
    filters,
  }
}
