import { describe, expect, it } from 'vitest'
import {
  FOOD_EXPENSE_CATEGORY,
  getCountryLocalCurrency,
  getTypicalFoodBudget,
} from './foodBudget'

describe('foodBudget', () => {
  it('returns local currency for country', () => {
    expect(getCountryLocalCurrency('TH')).toBe('THB')
    expect(getCountryLocalCurrency('ES')).toBe('EUR')
  })

  it('scales food budget by family size', () => {
    expect(getTypicalFoodBudget('ES', 1)).toBe(280)
    expect(getTypicalFoodBudget('ES', 2)).toBe(Math.round(280 * 1.85))
    expect(getTypicalFoodBudget('ES', 4)).toBe(Math.round(280 * (1.85 + 2 * 0.75)))
  })

  it('falls back to Spain for unknown country', () => {
    expect(getTypicalFoodBudget('XX', 1)).toBe(280)
  })

  it('uses minimum family size of 1', () => {
    expect(getTypicalFoodBudget('ES', 0)).toBe(280)
  })

  it('exports food category label', () => {
    expect(FOOD_EXPENSE_CATEGORY).toBe('Еда')
  })
})
