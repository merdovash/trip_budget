import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../types/budget'
import type { BudgetPresetData } from '../types/preset'
import { snapshotsEqual } from './presetSnapshotCompare'

function emptySnapshot(): BudgetPresetData {
  return {
    settings: { ...DEFAULT_SETTINGS },
    incomes: [],
    expenses: [],
    oneTimeExpenses: [],
  }
}

describe('snapshotsEqual', () => {
  it('returns true for identical snapshots', () => {
    const a = emptySnapshot()
    const b = emptySnapshot()
    expect(snapshotsEqual(a, b)).toBe(true)
  })

  it('ignores item ids', () => {
    const a = emptySnapshot()
    a.incomes = [
      { id: 'a', name: 'Salary', amount: 1000, currency: 'EUR', frequency: 'monthly', startDate: '2026-01-01' },
    ]
    const b = emptySnapshot()
    b.incomes = [
      { id: 'b', name: 'Salary', amount: 1000, currency: 'EUR', frequency: 'monthly', startDate: '2026-01-01' },
    ]
    expect(snapshotsEqual(a, b)).toBe(true)
  })

  it('returns false when content differs', () => {
    const a = emptySnapshot()
    const b = emptySnapshot()
    b.settings.baseCurrency = 'USD'
    expect(snapshotsEqual(a, b)).toBe(false)
  })
})
