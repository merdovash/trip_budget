import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './auth/password'
import { mergePresetData, rowToPreset, splitPresetData, toPresetSummary } from './presetPayload'
import type { BudgetPresetData } from '../src/types/preset'

describe('password hashing', () => {
  it('verifies hashed password', () => {
    const hash = hashPassword('secret-pass')
    expect(verifyPassword('secret-pass', hash)).toBe(true)
    expect(verifyPassword('wrong', hash)).toBe(false)
  })
})

describe('presetPayload', () => {
  const sample: BudgetPresetData = {
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
      residenceRoute: [
        {
          id: 'r1',
          countryCode: 'ES',
          taxRegimeId: 'es-standard',
          startDate: '2026-01-01',
          endDate: '9999-12-31',
        },
      ],
      initialBalances: [{ id: 'b1', amount: 1000, currency: 'EUR' }],
    },
    incomes: [
      {
        id: 'i1',
        name: 'Salary',
        amount: 3000,
        currency: 'EUR',
        frequency: 'monthly',
        startDate: '2026-01-01',
      },
    ],
    expenses: [
      {
        id: 'e1',
        name: 'Flight',
        amount: 500,
        currency: 'EUR',
        frequency: 'once',
        startDate: '2026-03-01',
      },
    ],
    folders: [{ id: 'f1', name: 'Home' }],
    incomeFolders: [],
    expenseCategories: [],
    oneTimeExpenses: [],
  }

  it('splits route and balances out of settings', () => {
    const cols = splitPresetData(sample)
    expect(cols.residenceRoute).toHaveLength(1)
    expect(cols.initialBalances).toHaveLength(1)
    expect(cols.settings.residenceRoute).toBeUndefined()
    expect(cols.settings.initialBalances).toBeUndefined()
    expect(cols.incomes).toHaveLength(1)
    expect(cols.folders).toHaveLength(1)
  })

  it('merges columns back into BudgetPresetData', () => {
    const cols = splitPresetData(sample)
    const merged = mergePresetData(cols)
    expect(merged.settings.residenceRoute).toHaveLength(1)
    expect(merged.settings.initialBalances?.[0]?.amount).toBe(1000)
    expect(merged.incomes[0]?.name).toBe('Salary')
    expect(merged.oneTimeExpenses).toEqual([])
  })

  it('rowToPreset assembles lists from child tables', () => {
    const cols = splitPresetData(sample)
    const preset = rowToPreset(
      {
        id: 'p1',
        user_id: 'u1',
        name: 'Test',
        description: '',
        is_private: false,
        settings: cols.settings,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
      cols,
    )
    expect(preset.data.incomes[0]?.name).toBe('Salary')
    expect(preset.data.expenses[0]?.frequency).toBe('once')
    expect(preset.data.settings.residenceRoute?.[0]?.endDate).toBe('9999-12-31')
  })

  it('toPresetSummary uses SQL counts', () => {
    const summary = toPresetSummary({
      id: 'p1',
      user_id: 'u1',
      name: 'Test',
      description: 'desc',
      is_private: false,
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
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      income_count: 3,
      expense_count: 5,
      once_count: 2,
    })
    expect(summary.incomeCount).toBe(3)
    expect(summary.expenseCount).toBe(5)
    expect(summary.oneTimeCount).toBe(2)
    expect(summary.countryCode).toBe('ES')
  })
})
