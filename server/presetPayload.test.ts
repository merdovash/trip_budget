import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './auth/password'
import { mergePresetData, splitPresetData } from './presetPayload'
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
    expenses: [],
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
})
