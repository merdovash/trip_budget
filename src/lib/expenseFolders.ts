import type { ExpenseFolder, RecurringItem } from '../types/budget'

/** ID папок, исключённых из расчётов. */
export function getExcludedFolderIds(folders: ExpenseFolder[]): Set<string> {
  return new Set(folders.filter((folder) => folder.excluded).map((folder) => folder.id))
}

/** Расходы без статей из исключённых папок (для прогноза и налогов). */
export function filterExpensesForCalculation(
  expenses: RecurringItem[],
  folders: ExpenseFolder[],
): RecurringItem[] {
  const excluded = getExcludedFolderIds(folders)
  if (excluded.size === 0) return expenses
  return expenses.filter((item) => !item.folderId || !excluded.has(item.folderId))
}
