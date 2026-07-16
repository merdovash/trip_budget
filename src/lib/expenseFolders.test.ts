import { describe, expect, it } from 'vitest'
import { filterExpensesForCalculation, getExcludedFolderIds } from './expenseFolders'
import type { ExpenseFolder, RecurringItem } from '../types/budget'

const folders: ExpenseFolder[] = [
  { id: 'f1', name: 'Жильё' },
  { id: 'f2', name: 'Отпуск', excluded: true },
]

const expenses: RecurringItem[] = [
  {
    id: 'e1',
    name: 'Аренда',
    amount: 1000,
    currency: 'EUR',
    frequency: 'monthly',
    folderId: 'f1',
    startDate: '2026-01-01',
  },
  {
    id: 'e2',
    name: 'Билеты',
    amount: 500,
    currency: 'EUR',
    frequency: 'once',
    folderId: 'f2',
    startDate: '2026-06-01',
  },
  {
    id: 'e3',
    name: 'Еда',
    amount: 300,
    currency: 'EUR',
    frequency: 'monthly',
    startDate: '2026-01-01',
  },
]

describe('expenseFolders', () => {
  it('collects excluded folder ids', () => {
    expect([...getExcludedFolderIds(folders)]).toEqual(['f2'])
  })

  it('filters out expenses from excluded folders', () => {
    const active = filterExpensesForCalculation(expenses, folders)
    expect(active.map((e) => e.id)).toEqual(['e1', 'e3'])
  })

  it('keeps all expenses when nothing is excluded', () => {
    expect(filterExpensesForCalculation(expenses, [{ id: 'f1', name: 'Жильё' }])).toHaveLength(3)
  })
})
