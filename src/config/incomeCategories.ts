import type { Frequency, RecurringItem } from '../types/budget'
import { todayIsoDate } from '../lib/format'

export interface IncomePaymentFieldDef {
  id: string
  label: string
  hint?: string
  requireDayOfMonth?: boolean
  defaultDayOfMonth?: number
}

export interface IncomeCategoryDef {
  id: string
  label: string
  paymentFields: IncomePaymentFieldDef[]
  defaultFrequency: Frequency
  showFrequency?: boolean
  showCustomName?: boolean
}

export const INCOME_CATEGORY_DEFS: IncomeCategoryDef[] = [
  {
    id: 'salary',
    label: 'Зарплата',
    paymentFields: [
      { id: 'advance', label: 'Аванс', requireDayOfMonth: true, defaultDayOfMonth: 25 },
      { id: 'payroll', label: 'Зарплата', requireDayOfMonth: true, defaultDayOfMonth: 10 },
    ],
    defaultFrequency: 'monthly',
    showFrequency: false,
  },
  {
    id: 'freelance',
    label: 'Фриланс',
    paymentFields: [{ id: 'amount', label: 'Сумма' }],
    defaultFrequency: 'monthly',
    showFrequency: true,
  },
  {
    id: 'business',
    label: 'Бизнес',
    paymentFields: [{ id: 'amount', label: 'Сумма' }],
    defaultFrequency: 'monthly',
    showFrequency: true,
  },
  {
    id: 'rent',
    label: 'Аренда',
    paymentFields: [{ id: 'amount', label: 'Сумма' }],
    defaultFrequency: 'monthly',
    showFrequency: true,
  },
  {
    id: 'dividends',
    label: 'Дивиденды',
    paymentFields: [{ id: 'amount', label: 'Сумма выплаты' }],
    defaultFrequency: 'yearly',
    showFrequency: true,
  },
  {
    id: 'other',
    label: 'Другое',
    paymentFields: [{ id: 'amount', label: 'Сумма' }],
    defaultFrequency: 'monthly',
    showFrequency: true,
    showCustomName: true,
  },
]

export function getIncomeCategoryDef(id: string): IncomeCategoryDef | undefined {
  return INCOME_CATEGORY_DEFS.find((c) => c.id === id)
}

export interface IncomePaymentEntry {
  amount: number
  dayOfMonth: number
}

export function createEmptyPaymentEntries(
  categoryId: string,
): Record<string, IncomePaymentEntry> {
  const def = getIncomeCategoryDef(categoryId)
  if (!def) return {}
  return Object.fromEntries(
    def.paymentFields.map((f) => [
      f.id,
      { amount: 0, dayOfMonth: f.defaultDayOfMonth ?? 1 },
    ]),
  )
}

export interface IncomeFormState {
  categoryId: string
  name: string
  payments: Record<string, IncomePaymentEntry>
  currency: string
  frequency: Frequency
  startDate: string
  endDate: string
}

export function createInitialIncomeForm(baseCurrency: string): IncomeFormState {
  return {
    categoryId: '',
    name: '',
    payments: {},
    currency: baseCurrency,
    frequency: 'monthly',
    startDate: todayIsoDate(),
    endDate: '',
  }
}

export function resolveIncomeCategoryId(item: RecurringItem): string {
  if (item.categoryId) return item.categoryId
  return INCOME_CATEGORY_DEFS.find((c) => c.label === item.category)?.id ?? 'other'
}

export function incomeItemToFormState(item: RecurringItem): IncomeFormState {
  const categoryId = resolveIncomeCategoryId(item)
  const def = getIncomeCategoryDef(categoryId)
  const payments = createEmptyPaymentEntries(categoryId)

  if (def && item.payments?.length) {
    def.paymentFields.forEach((field, index) => {
      const payment = item.payments![index]
      payments[field.id] = {
        amount: payment?.amount ?? 0,
        dayOfMonth: payment?.dayOfMonth ?? field.defaultDayOfMonth ?? 1,
      }
    })
  } else if (def?.paymentFields[0]) {
    const field = def.paymentFields[0]
    payments[field.id] = {
      amount: item.amount,
      dayOfMonth: field.defaultDayOfMonth ?? 1,
    }
  }

  const categoryDef = getIncomeCategoryDef(categoryId)
  return {
    categoryId,
    name: categoryDef?.showCustomName ? item.name : '',
    payments,
    currency: item.currency,
    frequency: item.frequency,
    startDate: item.startDate,
    endDate: item.endDate ?? '',
  }
}
