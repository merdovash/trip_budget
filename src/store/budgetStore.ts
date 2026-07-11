import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  BudgetSettings,
  OneTimeExpense,
  RecurringItem,
} from '../types/budget'
import type { BudgetPresetData } from '../types/preset'
import { DEFAULT_SETTINGS } from '../types/budget'
import { clonePresetData } from '../lib/presetsApi'

interface BudgetState {
  settings: BudgetSettings
  incomes: RecurringItem[]
  expenses: RecurringItem[]
  oneTimeExpenses: OneTimeExpense[]
  setSettings: (settings: Partial<BudgetSettings>) => void
  addIncome: (item: Omit<RecurringItem, 'id'>) => void
  updateIncome: (id: string, item: Partial<RecurringItem>) => void
  removeIncome: (id: string) => void
  addExpense: (item: Omit<RecurringItem, 'id'>) => void
  updateExpense: (id: string, item: Partial<RecurringItem>) => void
  removeExpense: (id: string) => void
  addOneTimeExpense: (item: Omit<OneTimeExpense, 'id'>) => void
  updateOneTimeExpense: (id: string, item: Partial<OneTimeExpense>) => void
  removeOneTimeExpense: (id: string) => void
  exportSnapshot: () => BudgetPresetData
  loadFromPreset: (data: BudgetPresetData) => void
}

function createId(): string {
  return crypto.randomUUID()
}

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      incomes: [],
      expenses: [],
      oneTimeExpenses: [],

      setSettings: (partial) =>
        set((state) => ({ settings: { ...state.settings, ...partial } })),

      addIncome: (item) =>
        set((state) => ({
          incomes: [...state.incomes, { ...item, id: createId() }],
        })),

      updateIncome: (id, item) =>
        set((state) => ({
          incomes: state.incomes.map((i) => (i.id === id ? { ...i, ...item } : i)),
        })),

      removeIncome: (id) =>
        set((state) => ({ incomes: state.incomes.filter((i) => i.id !== id) })),

      addExpense: (item) =>
        set((state) => ({
          expenses: [...state.expenses, { ...item, id: createId() }],
        })),

      updateExpense: (id, item) =>
        set((state) => ({
          expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...item } : e)),
        })),

      removeExpense: (id) =>
        set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) })),

      addOneTimeExpense: (item) =>
        set((state) => ({
          oneTimeExpenses: [...state.oneTimeExpenses, { ...item, id: createId() }],
        })),

      updateOneTimeExpense: (id, item) =>
        set((state) => ({
          oneTimeExpenses: state.oneTimeExpenses.map((e) =>
            e.id === id ? { ...e, ...item } : e,
          ),
        })),

      removeOneTimeExpense: (id) =>
        set((state) => ({
          oneTimeExpenses: state.oneTimeExpenses.filter((e) => e.id !== id),
        })),

      exportSnapshot: (): BudgetPresetData => {
        const { settings, incomes, expenses, oneTimeExpenses } = get()
        return clonePresetData({ settings, incomes, expenses, oneTimeExpenses })
      },

      loadFromPreset: (data: BudgetPresetData) =>
        set({
          settings: { ...data.settings },
          incomes: data.incomes.map((item) => ({ ...item, id: createId() })),
          expenses: data.expenses.map((item) => ({ ...item, id: createId() })),
          oneTimeExpenses: data.oneTimeExpenses.map((item) => ({ ...item, id: createId() })),
        }),
    }),
    { name: 'family-budget-storage' },
  ),
)
