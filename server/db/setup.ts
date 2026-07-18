import { bootstrapDatabase } from './bootstrap'
import { seed } from './seed'

/**
 * Full DB bring-up without Docker.
 * Prefer `npm run db:setup` (server/db/cli.ts) — this module is for imports/tests.
 */
export async function setup(): Promise<void> {
  await bootstrapDatabase()
  await seed()
  console.log('DB setup finished')
}