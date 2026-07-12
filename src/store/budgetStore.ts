import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  BudgetSettings,
  OneTimeExpense,
  RecurringItem,
} from '../types/budget'
import type { BudgetPresetData } from '../types/preset'
import { DEFAULT_SETTINGS } from '../types/budget'
import { migrateLegacyLoan } from '../lib/loanAmortization'
import { clonePresetData } from '../lib/presetsApi'
import { snapshotsEqual } from '../lib/presetSnapshotCompare'
import {
  buildProgramOneTimeExpenses,
  getRelocationDate,
  getRelocationProgram,
} from '../config/relocationPrograms'

export interface ActivePreset {
  id: string
  name: string
  ownerToken?: string
}

interface BudgetState {
  settings: BudgetSettings
  incomes: RecurringItem[]
  expenses: RecurringItem[]
  oneTimeExpenses: OneTimeExpense[]
  /** Набор, загруженный в текущую сессию (редактирование не сохраняется автоматически). */
  activePreset: ActivePreset | null
  /** Снимок на момент загрузки/сохранения набора — для индикатора несохранённых изменений. */
  presetBaseline: BudgetPresetData | null
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
  applyRelocationProgramExpenses: () => number
  exportSnapshot: () => BudgetPresetData
  loadFromPreset: (data: BudgetPresetData, activePreset?: ActivePreset | null) => void
  setActivePreset: (activePreset: ActivePreset | null) => void
  clearActivePreset: () => void
  markPresetSaved: () => void
  hasUnsavedPresetChanges: () => boolean
  canUpdateActivePreset: () => boolean
}

type PersistedBudgetState = Partial<BudgetState> & {
  loans?: Array<{
    id: string
    name: string
    principal: number
    currency: string
    termMonths: number
    annualRate: number
    startDate: string
  }>
}

function createId(): string {
  return crypto.randomUUID()
}

function migratePersistedState(persisted: PersistedBudgetState, current: BudgetState): BudgetState {
  const mergedSettings = { ...current.settings, ...persisted.settings }
  if (!mergedSettings.relocationDate) {
    mergedSettings.relocationDate = mergedSettings.initialBalanceDate ?? current.settings.relocationDate
  }
  if (!mergedSettings.relocationProgramId) {
    mergedSettings.relocationProgramId = 'none'
  }
  if (!mergedSettings.relocationMode) {
    mergedSettings.relocationMode = 'remote_employment'
  }
  if (!mergedSettings.employmentCountryCode) {
    mergedSettings.employmentCountryCode = 'RU'
  }

  const merged: BudgetState = {
    ...current,
    ...persisted,
    settings: mergedSettings,
    incomes: persisted.incomes ?? current.incomes,
    expenses: persisted.expenses ?? current.expenses,
    oneTimeExpenses: persisted.oneTimeExpenses ?? current.oneTimeExpenses,
  }

  if (persisted.loans?.length) {
    const migrated = persisted.loans.map((loan) => ({
      ...migrateLegacyLoan(loan),
      id: loan.id || createId(),
    }))
    merged.expenses = [...merged.expenses, ...migrated]
  }

  return merged
}

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      incomes: [],
      expenses: [],
      oneTimeExpenses: [],
      activePreset: null,
      presetBaseline: null,

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

      applyRelocationProgramExpenses: () => {
        const { settings, oneTimeExpenses } = get()
        const program = getRelocationProgram(settings.relocationProgramId)
        if (!program) return 0
        const templates = buildProgramOneTimeExpenses(program, getRelocationDate(settings))
        const existing = new Set(
          oneTimeExpenses.map((item) => `${item.name}|${item.date}|${item.amount}`),
        )
        const toAdd = templates
          .filter((item) => !existing.has(`${item.name}|${item.date}|${item.amount}`))
          .map((item) => ({ ...item, id: createId() }))
        if (toAdd.length > 0) {
          set((state) => ({
            oneTimeExpenses: [...state.oneTimeExpenses, ...toAdd],
          }))
        }
        return toAdd.length
      },

      exportSnapshot: (): BudgetPresetData => {
        const { settings, incomes, expenses, oneTimeExpenses } = get()
        return clonePresetData({ settings, incomes, expenses, oneTimeExpenses })
      },

      loadFromPreset: (data: BudgetPresetData, activePreset = null) => {
        const migratedLoans = (data.loans ?? []).map((loan) => ({
          ...migrateLegacyLoan(loan),
          id: createId(),
        }))
        set({
          settings: { ...data.settings },
          incomes: data.incomes.map((item) => ({ ...item, id: createId() })),
          expenses: [
            ...data.expenses.map((item) => ({ ...item, id: createId() })),
            ...migratedLoans,
          ],
          oneTimeExpenses: data.oneTimeExpenses.map((item) => ({ ...item, id: createId() })),
          activePreset,
          presetBaseline: clonePresetData(data),
        })
        get().markPresetSaved()
      },

      setActivePreset: (activePreset) => set({ activePreset }),

      clearActivePreset: () => set({ activePreset: null, presetBaseline: null }),

      markPresetSaved: () => {
        set({ presetBaseline: clonePresetData(get().exportSnapshot()) })
      },

      hasUnsavedPresetChanges: () => {
        const { activePreset, presetBaseline } = get()
        if (!activePreset || !presetBaseline) return false
        return !snapshotsEqual(get().exportSnapshot(), presetBaseline)
      },

      canUpdateActivePreset: () => Boolean(get().activePreset?.ownerToken),
    }),
    {
      name: 'family-budget-storage',
      partialize: (state) => ({
        settings: state.settings,
        incomes: state.incomes,
        expenses: state.expenses,
        oneTimeExpenses: state.oneTimeExpenses,
        activePreset: state.activePreset,
      }),
      merge: (persisted, current) =>
        migratePersistedState(persisted as PersistedBudgetState, current as BudgetState),
    },
  ),
)
