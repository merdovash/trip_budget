import { describe, expect, it } from 'vitest'
import {
  addDays,
  buildProgramOneTimeExpenses,
  getEffectiveStartDate,
  getRelocationProgramsForCountry,
  isItemActiveOnDay,
  RELOCATION_PROGRAMS,
} from '../config/relocationPrograms'
import type { BudgetSettings, RecurringItem } from '../types/budget'

const settings: BudgetSettings = {
  baseCurrency: 'EUR',
  countryCode: 'GE',
  taxRegimeId: 'ge-standard',
  familySize: 2,
  dependents: 0,
  horizonMonths: 12,
  initialBalance: 0,
  initialBalanceCurrency: 'EUR',
  initialBalanceDate: '2026-01-01',
  relocationDate: '2026-03-15',
  relocationProgramId: 'ge-remote-relocation',
}

describe('relocation date helpers', () => {
  it('delays destination expenses until relocation', () => {
    const expense: RecurringItem = {
      id: '1',
      name: 'Rent',
      amount: 1000,
      currency: 'GEL',
      frequency: 'monthly',
      lifecycle: 'destination',
      startDate: '2026-01-01',
    }
    expect(getEffectiveStartDate(expense, settings)).toBe('2026-03-15')
    expect(isItemActiveOnDay(expense, '2026-03-01', settings)).toBe(false)
    expect(isItemActiveOnDay(expense, '2026-03-15', settings)).toBe(true)
  })

  it('builds program one-time expenses with offsets', () => {
    const program = RELOCATION_PROGRAMS.find((p) => p.id === 'ge-remote-relocation')!
    const expenses = buildProgramOneTimeExpenses(program, settings.relocationDate)
    expect(expenses).toHaveLength(4)
    expect(expenses[0].date).toBe(addDays(settings.relocationDate, -5))
    expect(expenses[1].date).toBe(settings.relocationDate)
  })

  it('lists country-specific programs', () => {
    const gePrograms = getRelocationProgramsForCountry('GE')
    expect(gePrograms.some((p) => p.id === 'ge-remote-relocation')).toBe(true)
    expect(gePrograms.some((p) => p.id === 'generic-relocation')).toBe(true)
  })
})
