import { todayIsoDate } from '../lib/format'

export type Frequency = 'monthly' | 'yearly' | 'weekly' | 'once'

export interface IncomePayment {
  label: string
  amount: number
  dayOfMonth?: number
}

export interface RecurringItem {
  id: string
  name: string
  amount: number
  currency: string
  frequency: Frequency
  category?: string
  categoryId?: string
  /** Страна, где выплачивается зарплата (для categoryId === 'salary'). */
  salaryCountryCode?: string
  payments?: IncomePayment[]
  startDate: string
  endDate?: string
}
export interface OneTimeExpense {
  id: string
  name: string
  amount: number
  currency: string
  date: string
  category?: string
}

export interface BudgetSettings {
  baseCurrency: string
  countryCode: string
  taxRegimeId: string
  familySize: number
  dependents: number
  horizonMonths: number
  initialBalance: number
  initialBalanceCurrency: string
  initialBalanceDate: string
}

export interface MonthlySnapshot {
  month: string
  grossIncome: number
  netIncome: number
  recurringExpenses: number
  oneTimeExpenses: number
  taxes: number
  balance: number
  cumulativeBalance: number
}

export interface DailySnapshot {
  date: string
  grossIncome: number
  netIncome: number
  recurringExpenses: number
  oneTimeExpenses: number
  taxes: number
  balance: number
  cumulativeBalance: number
}

export type AppSection = 'dashboard' | 'settings' | 'income' | 'expenses' | 'onetime' | 'presets'

export const DEFAULT_SETTINGS: BudgetSettings = {
  baseCurrency: 'EUR',
  countryCode: 'ES',
  taxRegimeId: 'es-standard',
  familySize: 2,
  dependents: 0,
  horizonMonths: 12,
  initialBalance: 0,
  initialBalanceCurrency: 'EUR',
  initialBalanceDate: todayIsoDate(),
}

export const CURRENCIES = ['EUR', 'USD', 'RUB', 'THB', 'MYR', 'GBP', 'AED', 'GEL', 'MXN', 'IDR', 'VND'] as const

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  monthly: 'Ежемесячно',
  yearly: 'Ежегодно',
  weekly: 'Еженедельно',
  once: 'Разово',
}
