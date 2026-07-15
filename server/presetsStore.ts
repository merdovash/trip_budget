import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  BudgetPreset,
  BudgetPresetData,
  BudgetPresetSummary,
  CreatePresetInput,
} from '../src/types/preset'

export const DATA_DIR = path.resolve(process.cwd(), 'data')
export const PRESETS_FILE = path.join(DATA_DIR, 'presets.json')
export const PRESETS_SEED_FILE = path.join(DATA_DIR, 'presets.seed.json')

function getPresetsPath(): string {
  return process.env.PRESETS_FILE ?? PRESETS_FILE
}

function ensureDataFile(): void {
  const presetsPath = getPresetsPath()
  if (presetsPath === PRESETS_FILE && !fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!fs.existsSync(presetsPath)) {
    if (presetsPath === PRESETS_FILE && fs.existsSync(PRESETS_SEED_FILE)) {
      fs.copyFileSync(PRESETS_SEED_FILE, presetsPath)
    } else {
      fs.writeFileSync(presetsPath, '[]', 'utf-8')
    }
  }
}

export function readPresets(): BudgetPreset[] {
  ensureDataFile()
  const raw = fs.readFileSync(getPresetsPath(), 'utf-8')
  return JSON.parse(raw) as BudgetPreset[]
}

export function writePresets(presets: BudgetPreset[]): void {
  ensureDataFile()
  fs.writeFileSync(getPresetsPath(), JSON.stringify(presets, null, 2), 'utf-8')
}

export function toPresetSummary(preset: BudgetPreset): BudgetPresetSummary {
  const { settings, incomes, expenses, oneTimeExpenses } = preset.data
  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    isPrivate: preset.isPrivate,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
    countryCode: settings.countryCode,
    baseCurrency: settings.baseCurrency,
    familySize: settings.familySize,
    incomeCount: incomes.length,
    expenseCount: expenses.length,
    oneTimeCount: expenses.filter((item) => item.frequency === 'once').length + oneTimeExpenses.length,
  }
}

export function listPublicPresets(): BudgetPresetSummary[] {
  return readPresets()
    .filter((preset) => !preset.isPrivate)
    .map(toPresetSummary)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function listOwnedPresets(
  refs: Array<{ id: string; ownerToken: string }>,
): BudgetPresetSummary[] {
  const presets = readPresets()
  return refs
    .map((ref) =>
      presets.find((preset) => preset.id === ref.id && preset.ownerToken === ref.ownerToken),
    )
    .filter((preset): preset is BudgetPreset => Boolean(preset))
    .map(toPresetSummary)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getPresetById(id: string, ownerToken?: string): BudgetPreset | null {
  const preset = readPresets().find((item) => item.id === id)
  if (!preset) return null
  if (preset.isPrivate && preset.ownerToken !== ownerToken) return null
  return preset
}

export function createPreset(input: CreatePresetInput): BudgetPreset {
  const now = new Date().toISOString()
  const preset: BudgetPreset = {
    id: randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() ?? '',
    isPrivate: input.isPrivate ?? false,
    ownerToken: randomUUID(),
    createdAt: now,
    updatedAt: now,
    data: input.data,
  }

  const presets = readPresets()
  presets.push(preset)
  writePresets(presets)
  return preset
}

export function updatePreset(
  id: string,
  ownerToken: string,
  patch: Partial<Pick<BudgetPreset, 'name' | 'description' | 'isPrivate' | 'data'>>,
): BudgetPreset | null {
  const presets = readPresets()
  const index = presets.findIndex((item) => item.id === id)
  if (index === -1) return null

  const current = presets[index]
  if (current.ownerToken !== ownerToken) return null

  const updated: BudgetPreset = {
    ...current,
    ...patch,
    name: patch.name?.trim() ?? current.name,
    description: patch.description?.trim() ?? current.description,
    updatedAt: new Date().toISOString(),
  }
  presets[index] = updated
  writePresets(presets)
  return updated
}

export function deletePreset(id: string, ownerToken: string): boolean {
  const presets = readPresets()
  const index = presets.findIndex(
    (item) => item.id === id && item.ownerToken === ownerToken,
  )
  if (index === -1) return false
  presets.splice(index, 1)
  writePresets(presets)
  return true
}

export function clonePresetData(data: BudgetPresetData): BudgetPresetData {
  return structuredClone(data)
}
