import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type BudgetSettings } from '../types/budget'
import { migrateCountryDeductions } from './budgetStore'

describe('migrateCountryDeductions', () => {
  it('moves legacy Thailand deductions under the country key', () => {
    const legacy = {
      ...DEFAULT_SETTINGS,
      thailandDeductions: { lifeInsurance: 25_000 },
    } as BudgetSettings & {
      thailandDeductions?: { lifeInsurance: number }
    }

    const migrated = migrateCountryDeductions(legacy)

    expect(migrated.countryDeductions?.TH?.lifeInsurance).toBe(25_000)
    expect('thailandDeductions' in migrated).toBe(false)
  })

  it('preserves new settings when legacy data is also present', () => {
    const mixed = {
      ...DEFAULT_SETTINGS,
      countryDeductions: { TH: { lifeInsurance: 50_000 } },
      thailandDeductions: { lifeInsurance: 25_000 },
    } as BudgetSettings & {
      thailandDeductions?: { lifeInsurance: number }
    }

    const migrated = migrateCountryDeductions(mixed)

    expect(migrated.countryDeductions?.TH?.lifeInsurance).toBe(50_000)
    expect('thailandDeductions' in migrated).toBe(false)
  })
})
