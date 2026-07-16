import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../types/budget'
import {
  describeInitialBalances,
  getInitialBalanceInBase,
  getInitialBalances,
  getInitialSavingsBalanceFromEntries,
  migrateInitialBalances,
} from './initialBalance'

describe('initialBalance', () => {
  it('reads legacy single balance', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      initialBalance: 5000,
      initialBalanceCurrency: 'EUR',
    }
    expect(getInitialBalances(settings)).toHaveLength(1)
    expect(getInitialBalanceInBase(settings)).toBe(5000)
  })

  it('sums multiple currencies in base', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      baseCurrency: 'EUR',
      initialBalances: [
        { id: '1', amount: 1000, currency: 'EUR' },
        { id: '2', amount: 100_000, currency: 'RUB', comment: 'накопительный' },
      ],
    }
    expect(getInitialBalanceInBase(settings)).toBeCloseTo(1000 + 100_000 / 100, 5)
    expect(describeInitialBalances(settings)).toContain('накопительный')
  })

  it('sums savings currency entries including duplicates', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      savingsAccountCurrency: 'RUB',
      initialBalances: [
        { id: '1', amount: 50_000, currency: 'RUB' },
        { id: '2', amount: 70_000, currency: 'RUB', comment: 'вклад' },
        { id: '3', amount: 1000, currency: 'EUR' },
      ],
    }
    expect(getInitialSavingsBalanceFromEntries(settings)).toBe(120_000)
  })

  it('migrates legacy balance into list', () => {
    const migrated = migrateInitialBalances({
      ...DEFAULT_SETTINGS,
      initialBalance: 2500,
      initialBalanceCurrency: 'USD',
    })
    expect(migrated.initialBalances).toEqual([
      { id: 'migrated', amount: 2500, currency: 'USD' },
    ])
  })
})
