import type { BudgetSettings, ExpenseFolder, OneTimeExpense, RecurringItem } from './budget'

export interface BudgetPresetData {
  settings: BudgetSettings
  incomes: RecurringItem[]
  expenses: RecurringItem[]
  /** Папки для группировки расходов. */
  folders?: ExpenseFolder[]
  /** @deprecated Кредиты хранятся в expenses с expenseKind === 'loan'. */
  loans?: Array<{
    name: string
    principal: number
    currency: string
    termMonths: number
    annualRate: number
    startDate: string
  }>
  /** @deprecated Разовые траты хранятся в expenses с frequency === 'once'. */
  oneTimeExpenses: OneTimeExpense[]
}

export interface BudgetPreset {
  id: string
  name: string
  description: string
  isPrivate: boolean
  ownerToken: string
  createdAt: string
  updatedAt: string
  data: BudgetPresetData
}

export interface BudgetPresetSummary {
  id: string
  name: string
  description: string
  isPrivate: boolean
  createdAt: string
  updatedAt: string
  countryCode: string
  baseCurrency: string
  familySize: number
  incomeCount: number
  expenseCount: number
  oneTimeCount: number
}

export interface CreatePresetInput {
  name: string
  description?: string
  isPrivate?: boolean
  data: BudgetPresetData
}

export interface PresetOwnerRef {
  id: string
  ownerToken: string
  name: string
}
