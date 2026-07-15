import type { RecurringItem } from '../types/budget'
import {
  calculateRussiaSalaryMonthlyDisplay,
  type RussiaSalaryMonthlyDisplay,
} from './countries/russia'
import {
  calculateSpainSalaryMonthlyDisplay,
  type SpainSalaryMonthlyDisplay,
} from './countries/spain'

export type SalaryMonthlyDisplay = RussiaSalaryMonthlyDisplay | SpainSalaryMonthlyDisplay

/** Превью зарплаты у источника — диспатч по salaryCountryCode. */
export function getSalaryMonthlyDisplay(
  salaryCountryCode: string | undefined,
  payments: { id?: string; amount: number; dayOfMonth?: number }[],
  dependents: number,
): SalaryMonthlyDisplay | null {
  if (salaryCountryCode === 'RU') {
    return calculateRussiaSalaryMonthlyDisplay(payments, dependents)
  }
  if (salaryCountryCode === 'ES') {
    return calculateSpainSalaryMonthlyDisplay(payments, dependents)
  }
  return null
}

export function hasSourceWithholdingPreview(salaryCountryCode: string | undefined): boolean {
  return salaryCountryCode === 'RU' || salaryCountryCode === 'ES'
}

export function salaryPaymentsForDisplay(item: RecurringItem): {
  id?: string
  amount: number
  dayOfMonth?: number
}[] {
  if (item.payments?.length) {
    return item.payments.map((p) => ({
      id: p.label,
      amount: p.amount,
      dayOfMonth: p.dayOfMonth,
    }))
  }
  return [{ amount: item.amount, dayOfMonth: undefined }]
}
