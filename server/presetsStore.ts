import type { BudgetPreset, BudgetPresetData, BudgetPresetSummary, CreatePresetInput } from '../src/types/preset'
import { getPool } from './db/pool'
import { loadPresetChildren, replacePresetChildren } from './presetChildren'
import {
  rowToPreset,
  splitPresetData,
  toPresetSummary,
} from './presetPayload'
import type { PresetRow, PresetSummaryRow } from './presetPayload'

const SUMMARY_SELECT = `
  SELECT
    p.id, p.user_id, p.name, p.description, p.is_private, p.settings,
    p.created_at, p.updated_at,
    (SELECT COUNT(*)::int FROM preset_incomes i WHERE i.preset_id = p.id) AS income_count,
    (SELECT COUNT(*)::int FROM preset_expenses e WHERE e.preset_id = p.id) AS expense_count,
    (SELECT COUNT(*)::int FROM preset_expenses e WHERE e.preset_id = p.id AND e.frequency = 'once') AS once_count
  FROM presets p
`

export async function listPublicPresets(): Promise<BudgetPresetSummary[]> {
  const pool = getPool()
  const result = await pool.query<PresetSummaryRow>(
    `${SUMMARY_SELECT} WHERE p.is_private = false ORDER BY p.updated_at DESC`,
  )
  return result.rows.map((row) => toPresetSummary(normalizeSummaryRow(row)))
}

export async function listOwnedPresets(userId: string): Promise<BudgetPresetSummary[]> {
  const pool = getPool()
  const result = await pool.query<PresetSummaryRow>(
    `${SUMMARY_SELECT} WHERE p.user_id = $1 ORDER BY p.updated_at DESC`,
    [userId],
  )
  return result.rows.map((row) => toPresetSummary(normalizeSummaryRow(row)))
}

export async function getPresetById(
  id: string,
  viewerUserId?: string | null,
): Promise<BudgetPreset | null> {
  const pool = getPool()
  return pool.withConnection(async (query) => {
    const result = await query<PresetRow>(`SELECT * FROM presets WHERE id = $1`, [id])
    const row = result.rows[0]
    if (!row) return null
    const normalized = normalizeRow(row)
    if (normalized.is_private && normalized.user_id !== viewerUserId) return null
    const lists = await loadPresetChildren(query, normalized.id)
    return rowToPreset(normalized, lists)
  })
}

export async function createPreset(
  userId: string,
  input: CreatePresetInput,
): Promise<BudgetPreset> {
  const cols = splitPresetData(input.data)
  const pool = getPool()
  return pool.transaction(async (query) => {
    const result = await query<PresetRow>(
      `INSERT INTO presets (user_id, name, description, is_private, settings)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        userId,
        input.name.trim(),
        input.description?.trim() ?? '',
        input.isPrivate ?? false,
        cols.settings,
      ],
    )
    const row = normalizeRow(result.rows[0]!)
    await replacePresetChildren(query, row.id, cols)
    const lists = await loadPresetChildren(query, row.id)
    return rowToPreset(row, lists)
  })
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
  return pool.transaction(async (query) => {
    const result = await query<PresetRow>(
      `UPDATE presets SET
        name = $1,
        description = $2,
        is_private = $3,
        settings = $4,
        updated_at = now()
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [name, description, isPrivate, cols.settings, id, userId],
    )
    const row = result.rows[0]
    if (!row) return null
    const normalized = normalizeRow(row)
    await replacePresetChildren(query, normalized.id, cols)
    const lists = await loadPresetChildren(query, normalized.id)
    return rowToPreset(normalized, lists)
  })
}

export async function deletePreset(id: string, userId: string): Promise<boolean> {
  const pool = getPool()
  const result = await pool.query(
    `DELETE FROM presets WHERE id = $1 AND user_id = $2`,
    [id, userId],
  )
  return result.rowCount > 0
}

function normalizeRow(row: PresetRow): PresetRow {
  return {
    ...row,
    id: String(row.id),
    user_id: String(row.user_id),
    settings: asJsonObject(row.settings),
  }
}

function normalizeSummaryRow(row: PresetSummaryRow): PresetSummaryRow {
  return {
    ...normalizeRow(row),
    income_count: Number(row.income_count) || 0,
    expense_count: Number(row.expense_count) || 0,
    once_count: Number(row.once_count) || 0,
  }
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

export { clonePresetData } from './presetPayload'
