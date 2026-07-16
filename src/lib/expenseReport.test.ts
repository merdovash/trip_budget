import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type ExpenseFolder, type RecurringItem } from '../types/budget'
import { buildExpenseReport, expenseItemTotalInBase } from './expenseReport'

const settings = {
  ...DEFAULT_SETTINGS,
  baseCurrency: 'EUR',
  horizonMonths: 3,
  initialBalanceDate: '2026-01-01',
}

const folders: ExpenseFolder[] = [
  { id: 'home', name: 'Жильё' },
  { id: 'trip', name: 'Отпуск', excluded: true },
]

const expenses: RecurringItem[] = [
  {
    id: 'rent',
    name: 'Аренда',
    amount: 1000,
    currency: 'EUR',
    frequency: 'monthly',
    category: 'Жильё',
    folderId: 'home',
    startDate: '2026-01-01',
  },
  {
    id: 'food',
    name: 'Еда',
    amount: 300,
    currency: 'EUR',
    frequency: 'monthly',
    category: 'Еда',
    startDate: '2026-01-01',
  },
  {
    id: 'tickets',
    name: 'Билеты',
    amount: 500,
    currency: 'EUR',
    frequency: 'once',
    category: 'Путешествия',
    folderId: 'trip',
    startDate: '2026-02-01',
  },
]

describe('expenseReport', () => {
  it('sums monthly expense over horizon', () => {
    expect(expenseItemTotalInBase(expenses[0], settings)).toBe(3000)
  })

  it('builds category report excluding excluded folders', () => {
    const report = buildExpenseReport(expenses, folders, settings, 'categories')
    expect(report.rows.map((r) => r.label)).toEqual(['Жильё', 'Еда'])
    expect(report.grandTotalInBase).toBe(3000 + 900)
  })

  it('builds folder and item reports', () => {
    const byFolder = buildExpenseReport(expenses, folders, settings, 'folders')
    expect(byFolder.rows.some((r) => r.label === 'Отпуск')).toBe(false)
    expect(byFolder.rows.find((r) => r.label === 'Жильё')?.totalInBase).toBe(3000)

    const byItem = buildExpenseReport(expenses, folders, settings, 'items')
    expect(byItem.rows.map((r) => r.id)).toEqual(['rent', 'food'])
  })
})
