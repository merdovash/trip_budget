import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  BudgetSettings,
  ExpenseFolder,
  OneTimeExpense,
  RecurringItem,
} from '../types/budget'
import type { BudgetPresetData } from '../types/preset'
import { DEFAULT_SETTINGS } from '../types/budget'
import { migrateLegacyLoan } from '../lib/loanAmortization'
import { migrateLegacyOneTimeExpense } from '../lib/oneTimeExpense'
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
  folders: ExpenseFolder[]
  /** @deprecated Разовые траты в expenses с frequency === 'once'. */
  oneTimeExpenses: OneTimeExpense[]
  activePreset: ActivePreset | null
  presetBaseline: BudgetPresetData | null
  setSettings: (settings: Partial<BudgetSettings>) => void
  addIncome: (item: Omit<RecurringItem, 'id'>) => void
  updateIncome: (id: string, item: Partial<RecurringItem>) => void
  removeIncome: (id: string) => void
  addExpense: (item: Omit<RecurringItem, 'id'>) => void
  updateExpense: (id: string, item: Partial<RecurringItem>) => void
  removeExpense: (id: string) => void
  addFolder: (name: string) => string
  updateFolder: (id: string, patch: Partial<Pick<ExpenseFolder, 'name'>>) => void
  removeFolder: (id: string) => void
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

function migrateOneTimeIntoExpenses(
  expenses: RecurringItem[],
  oneTimeExpenses: OneTimeExpense[],
  settings: BudgetSettings,
): RecurringItem[] {
  if (oneTimeExpenses.length === 0) return expenses
  const migrated = oneTimeExpenses.map((item) => ({
    ...migrateLegacyOneTimeExpense(item, settings),
    id: item.id || createId(),
  }))
  return [...expenses, ...migrated]
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

  let expenses = persisted.expenses ?? current.expenses
  const oneTimeExpenses = persisted.oneTimeExpenses ?? []

  if (persisted.loans?.length) {
    const migrated = persisted.loans.map((loan) => ({
      ...migrateLegacyLoan(loan),
      id: loan.id || createId(),
    }))
    expenses = [...expenses, ...migrated]
  }

  expenses = migrateOneTimeIntoExpenses(expenses, oneTimeExpenses, mergedSettings)

  return {
    ...current,
    ...persisted,
    settings: mergedSettings,
    incomes: persisted.incomes ?? current.incomes,
    expenses,
    folders: persisted.folders ?? current.folders,
    oneTimeExpenses: [],
  }
}

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      incomes: [],
      expenses: [],
      folders: [],
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

      addFolder: (name) => {
        const id = createId()
        const trimmed = name.trim() || 'Новая папка'
        set((state) => ({
          folders: [
            ...state.folders,
            { id, name: trimmed, sortOrder: state.folders.length },
          ],
        }))
        return id
      },

      updateFolder: (id, patch) =>
        set((state) => ({
          folders: state.folders.map((folder) =>
            folder.id === id
              ? { ...folder, ...patch, name: patch.name?.trim() || folder.name }
              : folder,
          ),
        })),

      removeFolder: (id) =>
        set((state) => ({
          folders: state.folders.filter((folder) => folder.id !== id),
          expenses: state.expenses.map((expense) =>
            expense.folderId === id ? { ...expense, folderId: undefined } : expense,
          ),
        })),

      applyRelocationProgramExpenses: () => {
        const { settings, expenses } = get()
        const program = getRelocationProgram(settings.relocationProgramId)
        if (!program) return 0
        const templates = buildProgramOneTimeExpenses(program, getRelocationDate(settings))
        const existing = new Set(
          expenses
            .filter((item) => item.frequency === 'once')
            .map((item) => `${item.name}|${item.startDate}|${item.amount}`),
        )
        const toAdd = templates
          .filter((item) => !existing.has(`${item.name}|${item.startDate}|${item.amount}`))
          .map((item) => ({ ...item, id: createId() }))
        if (toAdd.length > 0) {
          set((state) => ({
            expenses: [...state.expenses, ...toAdd],
          }))
        }
        return toAdd.length
      },

      exportSnapshot: (): BudgetPresetData => {
        const { settings, incomes, expenses, folders } = get()
        return clonePresetData({ settings, incomes, expenses, folders, oneTimeExpenses: [] })
      },

      loadFromPreset: (data: BudgetPresetData, activePreset = null) => {
        const settings = { ...data.settings }
        const migratedLoans = (data.loans ?? []).map((loan) => ({
          ...migrateLegacyLoan(loan),
          id: createId(),
        }))
        const migratedOneTime = (data.oneTimeExpenses ?? []).map((item) => ({
          ...migrateLegacyOneTimeExpense(item, settings),
          id: createId(),
        }))
        const folderIdMap = new Map<string, string>()
        const folders = (data.folders ?? []).map((folder, index) => {
          const id = createId()
          folderIdMap.set(folder.id, id)
          return {
            id,
            name: folder.name,
            sortOrder: folder.sortOrder ?? index,
          }
        })
        const remapFolderId = (folderId?: string) =>
          folderId ? folderIdMap.get(folderId) : undefined

        set({
          settings,
          incomes: data.incomes.map((item) => ({ ...item, id: createId() })),
          expenses: [
            ...data.expenses.map((item) => ({
              ...item,
              id: createId(),
              folderId: remapFolderId(item.folderId),
            })),
            ...migratedLoans,
            ...migratedOneTime,
          ],
          folders,
          oneTimeExpenses: [],
          activePreset,
          presetBaseline: null,
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
        folders: state.folders,
        oneTimeExpenses: [],
        activePreset: state.activePreset,
      }),
      merge: (persisted, current) =>
        migratePersistedState(persisted as PersistedBudgetState, current as BudgetState),
    },
  ),
)
