import { todayIsoDate } from '../lib/format'

export type RelocationMode = 'remote_employment' | 'sole_proprietorship'

export type Frequency = 'monthly' | 'yearly' | 'weekly' | 'once'

export type ExpenseKind = 'regular' | 'loan'

export const LOAN_EXPENSE_CATEGORY = 'Кредит'

export interface IncomePayment {
  label: string
  amount: number
  dayOfMonth?: number
}

export type ItemLifecycle = 'destination' | 'origin' | 'any'

export type ExpenseCountryScope = 'employment' | 'residence' | 'other'

export interface ExpenseFolder {
  id: string
  name: string
  sortOrder?: number
}

export interface RecurringItem {
  id: string
  name: string
  amount: number
  currency: string
  frequency: Frequency
  category?: string
  categoryId?: string
  /** Когда статья относится к жизни в стране назначения / до переезда. */
  lifecycle?: ItemLifecycle
  /** Страна, где выплачивается зарплата (для categoryId === 'salary'). */
  salaryCountryCode?: string
  /** Учитывать доход в налогах страны проживания. По умолчанию: да, кроме зарплаты из РФ. */
  includeInResidenceTax?: boolean
  /** Зачёт уплаченного НДФЛ в РФ при декларации в стране проживания (ES / TH / GE). */
  foreignTaxCredit?: boolean
  payments?: IncomePayment[]
  startDate: string
  endDate?: string
  /** Вид расхода (только для статей расходов). */
  expenseKind?: ExpenseKind
  /** Сумма кредита (для expenseKind === 'loan'). */
  principal?: number
  /** Срок кредита в месяцах. */
  termMonths?: number
  /** Годовая процентная ставка, %. */
  annualRate?: number
  /** Папка для группировки доходов и расходов. */
  folderId?: string
  /** Где осуществляется расход: страна заработка, проживания или другое. */
  expenseCountryScope?: ExpenseCountryScope
  /** @deprecated используйте expenseCountryScope */
  expenseCountryCode?: string
}
export interface OneTimeExpense {
  id: string
  name: string
  amount: number
  currency: string
  date: string
  category?: string
  expenseCountryScope?: ExpenseCountryScope
  /** @deprecated используйте expenseCountryScope */
  expenseCountryCode?: string
}

export interface ThailandDeductionSettings {
  /** Родители 60+ в Таиланде (кол-во, макс. обычно 2 на налогоплательщика + супруг). */
  parentAllowances?: number
  /** Страхование жизни (THB), вместе с мед. макс. 100 000. */
  lifeInsurance?: number
  /** Медстрахование на себя (THB), макс. 25 000. */
  healthInsurance?: number
  /** Проценты по ипотеке первого жилья (THB), макс. 100 000. */
  mortgageInterest?: number
  /** Provident Fund (THB), в пределах общего потолка 500 000. */
  providentFund?: number
  /** RMF / SSF (THB). */
  rmfContribution?: number
  /** Уплаченные взносы Social Security работника (THB), макс. ~10 500. */
  socialSecurityPaid?: number
}

export interface CountryDeductionSettings {
  TH?: ThailandDeductionSettings
}

export interface InitialBalanceEntry {
  id: string
  amount: number
  currency: string
  comment?: string
}

export interface ResidenceRoutePoint {
  id: string
  countryCode: string
  taxRegimeId: string
  /** Дата начала проживания (включительно). */
  startDate: string
  /** Дата окончания проживания (включительно). */
  endDate: string
  /** Параметры налогового режима в этой точке (вычеты и пр.). */
  regimeParams?: ThailandDeductionSettings
}

export interface BudgetSettings {
  baseCurrency: string
  countryCode: string
  taxRegimeId: string
  familySize: number
  dependents: number
  /** Дополнительные налоговые вычеты по стране проживания. */
  countryDeductions?: CountryDeductionSettings
  /** Дата начала жизни в стране проживания (налоги и расходы «в стране» с этой даты). */
  relocationDate?: string
  /** Программа переезда — шаблон разовых расходов. */
  relocationProgramId?: string
  /** Способ переезда: удалённая зарплата или ИП в стране проживания. */
  relocationMode?: RelocationMode
  /** Страна работодателя / источника зарплаты (при remote_employment). */
  employmentCountryCode?: string
  /**
   * Маршрут проживания: произвольное число стран с датами.
   * Пустой/undefined — legacy-режим (countryCode + taxRegimeId + relocationDate).
   */
  residenceRoute?: ResidenceRoutePoint[]
  horizonMonths: number
  /** Начальные остатки в разных валютах (валюты могут повторяться). */
  initialBalances?: InitialBalanceEntry[]
  /** @deprecated Используйте initialBalances. */
  initialBalance: number
  /** @deprecated Используйте initialBalances. */
  initialBalanceCurrency: string
  initialBalanceDate: string
  /** Класть положительный остаток в валюте накопительного счёта. */
  parkBalanceOnSavingsAccount?: boolean
  /** Годовая ставка накопительного счёта (%). По умолчанию 16. */
  savingsAnnualRate?: number
  /** Валюта накопительного счёта (по умолчанию RUB). */
  savingsAccountCurrency?: string
}

export interface MonthlySnapshot {
  month: string
  grossIncome: number
  netIncome: number
  recurringExpenses: number
  oneTimeExpenses: number
  /** Выдача кредита в этом месяце (приток, не расход). */
  loanDisbursement: number
  /** Проценты накопительного счёта (native → base). */
  savingsInterest: number
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
  /** Выдача кредита в этот день (приток, не расход). */
  loanDisbursement: number
  /** Проценты накопительного счёта (native → base). */
  savingsInterest: number
  taxes: number
  balance: number
  cumulativeBalance: number
}

export type AppSection = 'dashboard' | 'settings' | 'income' | 'expenses' | 'presets'

export const DEFAULT_SETTINGS: BudgetSettings = {
  baseCurrency: 'EUR',
  countryCode: 'ES',
  taxRegimeId: 'es-employed',
  familySize: 2,
  dependents: 0,
  horizonMonths: 12,
  initialBalance: 0,
  initialBalanceCurrency: 'EUR',
  initialBalanceDate: todayIsoDate(),
  relocationDate: todayIsoDate(),
  relocationProgramId: 'none',
  relocationMode: 'remote_employment',
  employmentCountryCode: 'RU',
  parkBalanceOnSavingsAccount: false,
  savingsAnnualRate: 16,
  savingsAccountCurrency: 'RUB',
  residenceRoute: [
    {
      id: 'default',
      countryCode: 'ES',
      taxRegimeId: 'es-employed',
      startDate: todayIsoDate(),
      endDate: '9999-12-31',
    },
  ],
}

export const CURRENCIES = ['EUR', 'USD', 'RUB', 'THB', 'MYR', 'GBP', 'AED', 'GEL', 'MXN', 'IDR', 'VND'] as const

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  monthly: 'Ежемесячно',
  yearly: 'Ежегодно',
  weekly: 'Еженедельно',
  once: 'Разово',
}
