import type { BudgetPresetData } from '../types/preset'

/** Сравнение снимков без учёта id (они пересоздаются при загрузке). */
export function snapshotsEqual(a: BudgetPresetData, b: BudgetPresetData): boolean {
  return JSON.stringify(normalizeSnapshot(a)) === JSON.stringify(normalizeSnapshot(b))
}

function normalizeSnapshot(data: BudgetPresetData) {
  const stripId = <T extends { id?: string }>(items: T[]) =>
    items.map(({ id: _id, ...rest }) => rest)

  return {
    settings: data.settings,
    incomes: stripId(data.incomes),
    expenses: stripId(data.expenses),
    oneTimeExpenses: stripId(data.oneTimeExpenses),
  }
}
