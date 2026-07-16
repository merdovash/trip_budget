import { isItemActiveInMonth } from '../config/relocationPrograms'
import {
  foodMonthlyAmount,
  generateMonthKeys,
  getProjectionStartDate,
  isFoodExpense,
  toMonthlyAmount,
} from '../engine/budgetEngine'
import { convertCurrency } from './currency'
import { filterExpensesForCalculation } from './expenseFolders'
import {
  isLoanExpense,
  isLoanPaymentInMonth,
  loanMonthlyPayment,
} from './loanAmortization'
import { LOAN_EXPENSE_CATEGORY, type BudgetSettings, type ExpenseFolder, type RecurringItem } from '../types/budget'

export type ExpenseReportDimension = 'categories' | 'folders' | 'items'

export interface ExpenseReportRow {
  id: string
  label: string
  totalInBase: number
  share: number
  /** Сколько статей входит в группу (для категорий/папок). */
  itemCount?: number
  excluded?: boolean
}

export interface ExpenseReport {
  dimension: ExpenseReportDimension
  baseCurrency: string
  horizonMonths: number
  grandTotalInBase: number
  rows: ExpenseReportRow[]
}

function nativeAmountForMonth(item: RecurringItem, monthKey: string): number {
  if (isLoanExpense(item)) {
    return isLoanPaymentInMonth(item, monthKey) ? loanMonthlyPayment(item) : 0
  }
  if (item.frequency === 'once') return item.amount
  if (isFoodExpense(item) && item.frequency === 'monthly') {
    return foodMonthlyAmount(item.amount, monthKey)
  }
  return toMonthlyAmount(item.amount, item.frequency)
}

/** Сумма статьи за горизонт планирования в базовой валюте. */
export function expenseItemTotalInBase(
  item: RecurringItem,
  settings: BudgetSettings,
): number {
  const monthKeys = generateMonthKeys(getProjectionStartDate(settings), settings.horizonMonths)
  let total = 0
  for (const monthKey of monthKeys) {
    if (!isItemActiveInMonth(item, monthKey, settings)) continue
    if (item.frequency === 'once') {
      total += convertCurrency(item.amount, item.currency, settings.baseCurrency)
      continue
    }
    const native = nativeAmountForMonth(item, monthKey)
    if (native === 0) continue
    total += convertCurrency(native, item.currency, settings.baseCurrency)
  }
  return total
}

function folderLabel(
  folderId: string | undefined,
  folders: ExpenseFolder[],
): { label: string; excluded: boolean } {
  if (!folderId) return { label: 'Без папки', excluded: false }
  const folder = folders.find((f) => f.id === folderId)
  if (!folder) return { label: 'Без папки', excluded: false }
  return { label: folder.name, excluded: Boolean(folder.excluded) }
}

function categoryLabel(item: RecurringItem): string {
  if (isLoanExpense(item)) return LOAN_EXPENSE_CATEGORY
  return item.category?.trim() || 'Без категории'
}

function toRows(
  totals: Map<string, { label: string; total: number; itemCount: number; excluded?: boolean }>,
  grandTotal: number,
): ExpenseReportRow[] {
  return [...totals.entries()]
    .map(([id, value]) => ({
      id,
      label: value.label,
      totalInBase: value.total,
      share: grandTotal > 0 ? value.total / grandTotal : 0,
      itemCount: value.itemCount,
      excluded: value.excluded,
    }))
    .sort((a, b) => b.totalInBase - a.totalInBase)
}

export function buildExpenseReport(
  expenses: RecurringItem[],
  folders: ExpenseFolder[],
  settings: BudgetSettings,
  dimension: ExpenseReportDimension,
): ExpenseReport {
  const active = filterExpensesForCalculation(expenses, folders)
  const itemTotals = active.map((item) => ({
    item,
    total: expenseItemTotalInBase(item, settings),
  }))
  const grandTotalInBase = itemTotals.reduce((sum, row) => sum + row.total, 0)

  if (dimension === 'items') {
    const rows: ExpenseReportRow[] = itemTotals
      .map(({ item, total }) => ({
        id: item.id,
        label: item.name,
        totalInBase: total,
        share: grandTotalInBase > 0 ? total / grandTotalInBase : 0,
      }))
      .sort((a, b) => b.totalInBase - a.totalInBase)
    return {
      dimension,
      baseCurrency: settings.baseCurrency,
      horizonMonths: settings.horizonMonths,
      grandTotalInBase,
      rows,
    }
  }

  const totals = new Map<string, { label: string; total: number; itemCount: number; excluded?: boolean }>()

  for (const { item, total } of itemTotals) {
    if (dimension === 'categories') {
      const label = categoryLabel(item)
      const id = `cat:${label}`
      const prev = totals.get(id) ?? { label, total: 0, itemCount: 0 }
      prev.total += total
      prev.itemCount += 1
      totals.set(id, prev)
    } else {
      const { label, excluded } = folderLabel(item.folderId, folders)
      const id = item.folderId ? `folder:${item.folderId}` : 'folder:none'
      const prev = totals.get(id) ?? { label, total: 0, itemCount: 0, excluded }
      prev.total += total
      prev.itemCount += 1
      totals.set(id, prev)
    }
  }

  return {
    dimension,
    baseCurrency: settings.baseCurrency,
    horizonMonths: settings.horizonMonths,
    grandTotalInBase,
    rows: toRows(totals, grandTotalInBase),
  }
}
