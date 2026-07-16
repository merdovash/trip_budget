import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type BudgetSettings } from '../types/budget'
import { migrateCountryDeductions, migrateRegimeParamsToRoute } from './budgetStore'

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

describe('migrateRegimeParamsToRoute', () => {
  it('moves global TH deductions into TH route points', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      countryCode: 'TH',
      taxRegimeId: 'th-standard',
      countryDeductions: { TH: { lifeInsurance: 40_000 } },
      residenceRoute: [
        {
          id: 'th1',
          countryCode: 'TH',
          taxRegimeId: 'th-standard',
          startDate: '2026-01-01',
          endDate: '9999-12-31',
        },
      ],
    }

    const migrated = migrateRegimeParamsToRoute(settings)

    expect(migrated.residenceRoute?.[0].regimeParams?.lifeInsurance).toBe(40_000)
    expect(migrated.countryDeductions?.TH).toBeUndefined()
  })
})
