/**
 * Minimal ambient types for `node:sqlite`.
 *
 * The repo pins @types/node 20.x, which predates the node:sqlite typings (the
 * module landed in Node 22 and is stable in the Node 25 this repo runs on).
 * Declaring just the surface kin/__tests__ uses is cheaper and lower-risk than
 * bumping @types/node, which would ripple through every Next.js type in the
 * project — and the dependency tree is itself gated by criterion EN-3.
 *
 * Extend this as the Kin suites need more of the API; do not widen it to `any`.
 */
declare module 'node:sqlite' {
  interface StatementSync {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint }
    get(...params: unknown[]): Record<string, unknown> | undefined
    all(...params: unknown[]): Record<string, unknown>[]
  }

  export class DatabaseSync {
    constructor(path: string, options?: { open?: boolean; readOnly?: boolean })
    exec(sql: string): void
    prepare(sql: string): StatementSync
    close(): void
  }
}
