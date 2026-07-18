import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BudgetPreset } from '../../src/types/preset'
import { hashPassword } from '../auth/password'
import { getPool, loadEnvFile } from './pool'
import { newId } from './mysqlClient'
import { migrate } from './migrate'
import { replacePresetChildren } from '../presetChildren'
import { splitPresetData } from '../presetPayload'

const SEED_EMAIL = 'seed@local'
const SEED_PASSWORD = 'seed-not-for-login'

function readSeedPresets(): BudgetPreset[] {
  const dataDir = path.resolve(process.cwd(), 'data')
  const seedFile = path.join(dataDir, 'presets.seed.json')
  const liveFile = path.join(dataDir, 'presets.json')
  const file = fs.existsSync(seedFile) ? seedFile : liveFile
  if (!fs.existsSync(file)) {
    console.log('No presets seed file found, skipping preset seed')
    return []
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as BudgetPreset[]
  return raw.filter((preset) => !preset.isPrivate)
}

function toMysqlDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 19).replace('T', ' ')
  return d.toISOString().slice(0, 23).replace('T', ' ')
}

async function ensureSeedUser(): Promise<string> {
  const pool = getPool()
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`,
    [SEED_EMAIL],
  )
  if (existing.rows[0]) return String(existing.rows[0].id)

  const id = newId()
  await pool.query(
    `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`,
    [id, SEED_EMAIL, hashPassword(SEED_PASSWORD)],
  )
  return id
}

export async function seed(): Promise<void> {
  loadEnvFile()
  await migrate()
  const userId = await ensureSeedUser()
  const presets = readSeedPresets()
  const pool = getPool()

  const count = await pool.query<{ count: number }>(`SELECT COUNT(*) AS count FROM presets`)
  if ((count.rows[0]?.count ?? 0) > 0) {
    console.log('Presets already present, skip seeding')
    return
  }

  for (const preset of presets) {
    const cols = splitPresetData(preset.data)
    await pool.transaction(async (query) => {
      await query(
        `INSERT INTO presets (
          id, user_id, name, description, is_private, settings, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, 0, $5, $6, $7
        )`,
        [
          preset.id,
          userId,
          preset.name,
          preset.description ?? '',
          cols.settings,
          toMysqlDateTime(preset.createdAt),
          toMysqlDateTime(preset.updatedAt),
        ],
      )
      await replacePresetChildren(query, preset.id, cols)
    })
  }

  console.log(`Seeded ${presets.length} public presets as ${SEED_EMAIL}`)
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  seed().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
