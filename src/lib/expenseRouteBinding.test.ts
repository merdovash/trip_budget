import { describe, expect, it } from 'vitest'
import type { RecurringItem, ResidenceRoutePoint } from '../types/budget'
import {
  applyRouteDatesToExpense,
  datesFromRoutePoint,
  syncExpensesToRoute,
} from './expenseRouteBinding'

const point: ResidenceRoutePoint = {
  id: 'es-1',
  countryCode: 'ES',
  taxRegimeId: 'es-beck',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
}

const openPoint: ResidenceRoutePoint = {
  ...point,
  id: 'es-open',
  endDate: '9999-12-31',
}

function expense(partial: Partial<RecurringItem> = {}): RecurringItem {
  return {
    id: 'e1',
    name: 'Аренда',
    amount: 1000,
    currency: 'EUR',
    frequency: 'monthly',
    expenseKind: 'regular',
    startDate: '2025-01-01',
    endDate: '2025-06-30',
    routePointId: 'es-1',
    ...partial,
  }
}

describe('expenseRouteBinding', () => {
  it('maps open-ended route end to undefined expense endDate', () => {
    expect(datesFromRoutePoint(openPoint)).toEqual({
      startDate: '2026-01-01',
      endDate: undefined,
    })
  })

  it('updates linked expense dates when route point dates change', () => {
    const synced = syncExpensesToRoute(
      [expense()],
      [{ ...point, startDate: '2027-03-01', endDate: '2027-09-30' }],
    )
    expect(synced[0]?.startDate).toBe('2027-03-01')
    expect(synced[0]?.endDate).toBe('2027-09-30')
    expect(synced[0]?.routePointId).toBe('es-1')
  })

  it('clears routePointId when point is removed but keeps dates', () => {
    const before = expense({ startDate: '2026-01-01', endDate: '2026-12-31' })
    const synced = applyRouteDatesToExpense(before, [])
    expect(synced.routePointId).toBeUndefined()
    expect(synced.startDate).toBe('2026-01-01')
    expect(synced.endDate).toBe('2026-12-31')
  })

  it('applies open end as cleared endDate on sync', () => {
    const synced = applyRouteDatesToExpense(expense({ routePointId: 'es-open' }), [openPoint])
    expect(synced.startDate).toBe('2026-01-01')
    expect(synced.endDate).toBeUndefined()
    expect(synced.routePointId).toBe('es-open')
  })

  it('leaves unbound and once/loan expenses unchanged', () => {
    const unbound = expense({ routePointId: undefined })
    const once = expense({ frequency: 'once', routePointId: 'es-1', endDate: undefined })
    const loan = expense({ expenseKind: 'loan', routePointId: 'es-1', termMonths: 12 })
    expect(applyRouteDatesToExpense(unbound, [point])).toBe(unbound)
    expect(applyRouteDatesToExpense(once, [point]).routePointId).toBeUndefined()
    expect(applyRouteDatesToExpense(loan, [point]).routePointId).toBeUndefined()
  })
})
