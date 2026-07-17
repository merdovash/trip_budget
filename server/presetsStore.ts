import type { BudgetPreset, BudgetPresetData, BudgetPresetSummary, CreatePresetInput } from '../src/types/preset'
import { getPool } from './db/pool'
import {
  PresetRow,
  rowToPreset,
  splitPresetData,
  toPresetSummary,
} from './presetPayload'

export async function listPublicPresets(): Promise<BudgetPresetSummary[]> {
  const pool = getPool()
  const result = await pool.query<PresetRow>(
    `SELECT * FROM presets WHERE is_private = false ORDER BY updated_at DESC`,
  )
  return result.rows.map((row) => toPresetSummary(rowToPreset(normalizeRow(row))))
}

export async function listOwnedPresets(userId: string): Promise<BudgetPresetSummary[]> {
  const pool = getPool()
  const result = await pool.query<PresetRow>(
    `SELECT * FROM presets WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId],
  )
  return result.rows.map((row) => toPresetSummary(rowToPreset(normalizeRow(row))))
}

export async function getPresetById(
  id: string,
  viewerUserId?: string | null,
): Promise<BudgetPreset | null> {
  const pool = getPool()
  const result = await pool.query<PresetRow>(`SELECT * FROM presets WHERE id = $1`, [id])
  const row = result.rows[0]
  if (!row) return null
  const preset = rowToPreset(normalizeRow(row))
  if (preset.isPrivate && preset.ownerId !== viewerUserId) return null
  return preset
}

export async function createPreset(
  userId: string,
  input: CreatePresetInput,
): Promise<BudgetPreset> {
  const cols = splitPresetData(input.data)
  const pool = getPool()
  const result = await pool.query<PresetRow>(
    `INSERT INTO presets (
      user_id, name, description, is_private,
      settings, residence_route, initial_balances, incomes, expenses,
      folders, income_folders, expense_categories
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8, $9,
      $10, $11, $12
    ) RETURNING *`,
    [
      userId,
      input.name.trim(),
      input.description?.trim() ?? '',
      input.isPrivate ?? false,
      cols.settings,
      cols.residenceRoute,
      cols.initialBalances,
      cols.incomes,
      cols.expenses,
      cols.folders,
      cols.incomeFolders,
      cols.expenseCategories,
    ],
  )
  return rowToPreset(normalizeRow(result.rows[0]!))
}

export async function updatePreset(
  id: string,
  userId: string,
  patch: Partial<Pick<BudgetPreset, 'name' | 'description' | 'isPrivate' | 'data'>>,
): Promise<BudgetPreset | null> {
  const existing = await getPresetById(id, userId)
  if (!existing || existing.ownerId !== userId) return null

  const nextData: BudgetPresetData = patch.data ?? existing.data
  const cols = splitPresetData(nextData)
  const name = patch.name?.trim() ?? existing.name
  const description = patch.description?.trim() ?? existing.description
  const isPrivate = patch.isPrivate ?? existing.isPrivate

  const pool = getPool()
  const result = await pool.query<PresetRow>(
    `UPDATE presets SET
      name = $1,
      description = $2,
      is_private = $3,
      settings = $4,
      residence_route = $5,
      initial_balances = $6,
      incomes = $7,
      expenses = $8,
      folders = $9,
      income_folders = $10,
      expense_categories = $11,
      updated_at = now()
     WHERE id = $12 AND user_id = $13
     RETURNING *`,
    [
      name,
      description,
      isPrivate,
      cols.settings,
      cols.residenceRoute,
      cols.initialBalances,
      cols.incomes,
      cols.expenses,
      cols.folders,
      cols.incomeFolders,
      cols.expenseCategories,
      id,
      userId,
    ],
  )
  const row = result.rows[0]
  return row ? rowToPreset(normalizeRow(row)) : null
}

export async function deletePreset(id: string, userId: string): Promise<boolean> {
  const pool = getPool()
  const result = await pool.query(
    `DELETE FROM presets WHERE id = $1 AND user_id = $2`,
    [id, userId],
  )
  return result.rowCount > 0
}

/** pg text protocol may leave uuid fields as strings; ensure JSON fields are objects. */
function normalizeRow(row: PresetRow): PresetRow {
  return {
    ...row,
    id: String(row.id),
    user_id: String(row.user_id),
    settings: asJsonObject(row.settings),
    residence_route: asJsonArray(row.residence_route),
    initial_balances: asJsonArray(row.initial_balances),
    incomes: asJsonArray(row.incomes),
    expenses: asJsonArray(row.expenses),
    folders: asJsonArray(row.folders),
    income_folders: asJsonArray(row.income_folders),
    expense_categories: asJsonArray(row.expense_categories),
  } as PresetRow
}

function asJsonObject<T extends object>(value: unknown): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as T
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return {} as T
    }
  }
  return {} as T
}

function asJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }
  return []
}

export { clonePresetData } from './presetPayload'
