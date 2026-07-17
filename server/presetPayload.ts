import type {
  BudgetSettings,
  ExpenseCategory,
  ExpenseFolder,
  InitialBalanceEntry,
  RecurringItem,
  ResidenceRoutePoint,
} from '../../src/types/budget'
import type { BudgetPreset, BudgetPresetData, BudgetPresetSummary } from '../../src/types/preset'

export interface PresetColumns {
  settings: BudgetSettings
  residenceRoute: ResidenceRoutePoint[]
  initialBalances: InitialBalanceEntry[]
  incomes: RecurringItem[]
  expenses: RecurringItem[]
  folders: ExpenseFolder[]
  incomeFolders: ExpenseFolder[]
  expenseCategories: ExpenseCategory[]
}

export interface PresetRow {
  id: string
  user_id: string
  name: string
  description: string
  is_private: boolean
  settings: BudgetSettings
  residence_route: ResidenceRoutePoint[]
  initial_balances: InitialBalanceEntry[]
  incomes: RecurringItem[]
  expenses: RecurringItem[]
  folders: ExpenseFolder[]
  income_folders: ExpenseFolder[]
  expense_categories: ExpenseCategory[]
  created_at: Date | string
  updated_at: Date | string
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

/** Split client `BudgetPresetData` into DB JSONB columns. */
export function splitPresetData(data: BudgetPresetData): PresetColumns {
  const {
    residenceRoute = [],
    initialBalances = [],
    ...settingsRest
  } = data.settings

  return {
    settings: settingsRest as BudgetSettings,
    residenceRoute: asArray<ResidenceRoutePoint>(residenceRoute),
    initialBalances: asArray<InitialBalanceEntry>(initialBalances),
    incomes: asArray<RecurringItem>(data.incomes),
    expenses: asArray<RecurringItem>(data.expenses),
    folders: asArray<ExpenseFolder>(data.folders),
    incomeFolders: asArray<ExpenseFolder>(data.incomeFolders),
    expenseCategories: asArray<ExpenseCategory>(data.expenseCategories),
  }
}

/** Merge DB columns back into client `BudgetPresetData`. */
export function mergePresetData(cols: PresetColumns): BudgetPresetData {
  return {
    settings: {
      ...cols.settings,
      residenceRoute: cols.residenceRoute,
      initialBalances: cols.initialBalances,
    },
    incomes: cols.incomes,
    expenses: cols.expenses,
    folders: cols.folders,
    incomeFolders: cols.incomeFolders,
    expenseCategories: cols.expenseCategories,
    oneTimeExpenses: [],
  }
}

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString()
  return new Date(value).toISOString()
}

export function rowToPreset(row: PresetRow): BudgetPreset {
  const data = mergePresetData({
    settings: row.settings,
    residenceRoute: asArray(row.residence_route),
    initialBalances: asArray(row.initial_balances),
    incomes: asArray(row.incomes),
    expenses: asArray(row.expenses),
    folders: asArray(row.folders),
    incomeFolders: asArray(row.income_folders),
    expenseCategories: asArray(row.expense_categories),
  })

  return {
    id: row.id,
    ownerId: row.user_id,
    name: row.name,
    description: row.description,
    isPrivate: row.is_private,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    data,
  }
}

export function toPresetSummary(preset: BudgetPreset): BudgetPresetSummary {
  const { settings, incomes, expenses } = preset.data
  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    isPrivate: preset.isPrivate,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
    countryCode: settings.countryCode,
    baseCurrency: settings.baseCurrency,
    familySize: settings.familySize,
    incomeCount: incomes.length,
    expenseCount: expenses.length,
    oneTimeCount: expenses.filter((item) => item.frequency === 'once').length,
  }
}

export function clonePresetData(data: BudgetPresetData): BudgetPresetData {
  return structuredClone(data)
}
