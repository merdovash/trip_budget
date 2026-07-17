import type { RecurringItem, ResidenceRoutePoint } from '../types/budget'

const OPEN_END = '9999-12-31'

export function datesFromRoutePoint(point: ResidenceRoutePoint): {
  startDate: string
  endDate?: string
} {
  return {
    startDate: point.startDate,
    endDate: point.endDate === OPEN_END ? undefined : point.endDate,
  }
}

export function isRouteBoundPeriodicExpense(item: RecurringItem): boolean {
  return Boolean(
    item.routePointId &&
      item.frequency !== 'once' &&
      item.expenseKind !== 'loan',
  )
}

/** Обновляет даты расхода по маршруту или снимает битую привязку. */
export function applyRouteDatesToExpense(
  expense: RecurringItem,
  route: ResidenceRoutePoint[],
): RecurringItem {
  if (!expense.routePointId) return expense
  if (expense.frequency === 'once' || expense.expenseKind === 'loan') {
    const { routePointId: _removed, ...rest } = expense
    return rest
  }

  const point = route.find((p) => p.id === expense.routePointId)
  if (!point) {
    const { routePointId: _removed, ...rest } = expense
    return rest
  }

  const dates = datesFromRoutePoint(point)
  if (expense.startDate === dates.startDate && expense.endDate === dates.endDate) {
    return expense
  }
  return { ...expense, ...dates }
}

export function syncExpensesToRoute(
  expenses: RecurringItem[],
  route: ResidenceRoutePoint[],
): RecurringItem[] {
  let changed = false
  const next = expenses.map((expense) => {
    const synced = applyRouteDatesToExpense(expense, route)
    if (synced !== expense) changed = true
    return synced
  })
  return changed ? next : expenses
}

/** При сохранении расхода с привязкой — проставить актуальные даты точки. */
export function withRouteDates<T extends Pick<RecurringItem, 'routePointId' | 'frequency' | 'expenseKind' | 'startDate'> & Partial<RecurringItem>>(
  expense: T,
  route: ResidenceRoutePoint[],
): T {
  if (!expense.routePointId) return expense
  if (expense.frequency === 'once' || expense.expenseKind === 'loan') {
    const { routePointId: _removed, ...rest } = expense
    return rest as T
  }
  const point = route.find((p) => p.id === expense.routePointId)
  if (!point) {
    const { routePointId: _removed, ...rest } = expense
    return rest as T
  }
  return { ...expense, ...datesFromRoutePoint(point) }
}
