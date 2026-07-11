import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { BudgetPresetData } from '../src/types/preset'
import {
  createPreset,
  deletePreset,
  getPresetById,
  listOwnedPresets,
  listPublicPresets,
  updatePreset,
} from './presetsStore'

const sampleData: BudgetPresetData = {
  settings: {
    baseCurrency: 'EUR',
    countryCode: 'ES',
    taxRegimeId: 'es-standard',
    familySize: 2,
    dependents: 0,
    horizonMonths: 12,
    initialBalance: 0,
    initialBalanceCurrency: 'EUR',
    initialBalanceDate: '2026-01-01',
  },
  incomes: [],
  expenses: [],
  oneTimeExpenses: [],
}

describe('presetsStore', () => {
  let tempFile: string

  beforeEach(() => {
    tempFile = path.join(os.tmpdir(), `presets-test-${Date.now()}.json`)
    process.env.PRESETS_FILE = tempFile
    fs.writeFileSync(tempFile, '[]', 'utf-8')
  })

  afterEach(() => {
    delete process.env.PRESETS_FILE
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
  })

  it('creates public preset by default', () => {
    const preset = createPreset({ name: 'Test', data: sampleData })
    expect(preset.isPrivate).toBe(false)
    expect(listPublicPresets()).toHaveLength(1)
  })

  it('hides private presets from public list', () => {
    const preset = createPreset({ name: 'Secret', isPrivate: true, data: sampleData })
    expect(listPublicPresets()).toHaveLength(0)
    expect(getPresetById(preset.id)).toBeNull()
    expect(getPresetById(preset.id, preset.ownerToken)).not.toBeNull()
  })

  it('lists owned presets by refs', () => {
    const preset = createPreset({ name: 'Mine', isPrivate: true, data: sampleData })
    const owned = listOwnedPresets([{ id: preset.id, ownerToken: preset.ownerToken }])
    expect(owned).toHaveLength(1)
    expect(owned[0].name).toBe('Mine')
  })

  it('updates and deletes with owner token', () => {
    const preset = createPreset({ name: 'Old', data: sampleData })
    const updated = updatePreset(preset.id, preset.ownerToken, { name: 'New', isPrivate: true })
    expect(updated?.name).toBe('New')
    expect(updated?.isPrivate).toBe(true)

    expect(deletePreset(preset.id, preset.ownerToken)).toBe(true)
    expect(getPresetById(preset.id, preset.ownerToken)).toBeNull()
  })
})
