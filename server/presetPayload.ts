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

export type PresetListColumns = Omit<PresetColumns, 'settings'>

export interface PresetRow {
  id: string
  user_id: string
  name: string
  description: string
  is_private: boolean
  settings: BudgetSettings
  created_at: Date | string
  updated_at: Date | string
}

export interface PresetSummaryRow extends PresetRow {
  income_count: number
  expense_count: number
  once_count: number
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

/** Split client `BudgetPresetData` into settings + list columns. */
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

/** Merge settings + list columns back into client `BudgetPresetData`. */
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

export function rowToPreset(row: PresetRow, lists: PresetListColumns): BudgetPreset {
  const data = mergePresetData({
    settings: row.settings,
    ...lists,
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

export function toPresetSummary(
  row: PresetSummaryRow,
): BudgetPresetSummary {
  const settings = row.settings
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isPrivate: row.is_private,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    countryCode: settings.countryCode,
    baseCurrency: settings.baseCurrency,
    familySize: settings.familySize,
    incomeCount: Number(row.income_count) || 0,
    expenseCount: Number(row.expense_count) || 0,
    oneTimeCount: Number(row.once_count) || 0,
  }
}

export function clonePresetData(data: BudgetPresetData): BudgetPresetData {
  return structuredClone(data)
}
