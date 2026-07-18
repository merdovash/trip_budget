import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bootstrapDatabase } from './bootstrap'
import { seed } from './seed'

/**
 * Full DB bring-up without Docker:
 *   1) create role + database (PG_ADMIN_URL)
 *   2) apply migrations + seed (via seed())
 */
async function setup(): Promise<void> {
  await bootstrapDatabase()
  await seed()
  console.log('DB setup finished')
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  setup().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
