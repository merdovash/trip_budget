import type { RecurringItem } from '../types/budget'
import { isIncludedInResidenceTax, isRussiaSalary } from './incomeSourceTax'
import { isRussiaSalaryInSpanishBase, usesForeignTaxCredit } from './spainForeignSalary'

/** Как облагается доход в модели избежания двойного налогообложения. */
export type IncomeTaxTreatment =
  | 'residence'
  | 'residence_with_credit'
  | 'source_russia'
  | 'excluded'
  | 'none'

export function getIncomeTaxTreatment(item: RecurringItem): IncomeTaxTreatment {
  if (!isIncludedInResidenceTax(item)) {
    return isRussiaSalary(item) ? 'source_russia' : 'excluded'
  }
  if (isRussiaSalaryInSpanishBase(item)) {
    return usesForeignTaxCredit(item) ? 'residence_with_credit' : 'residence'
  }
  return 'residence'
}

/** НДФЛ у источника в РФ — если доход не в декларации ES или включён с зачётом. */
export function isRussiaSourceTaxable(item: RecurringItem): boolean {
  if (!isRussiaSalary(item)) return false
  if (!isIncludedInResidenceTax(item)) return true
  return usesForeignTaxCredit(item)
}

export const DOUBLE_TAXATION_RULES = [
  {
    title: 'Зарплата из России (по умолчанию)',
    text: 'НДФЛ удерживается в РФ. Доход исключён из IRPF страны проживания — двойного налогообложения нет.',
  },
  {
    title: 'Зарплата из России + «Учитывать в налогах проживания»',
    text: 'Доход в декларации IRPF: применяются вычеты Испании (mínimo personal). Без зачёта НДФЛ — только IRPF в ES. С зачётом НДФЛ — НДФЛ в РФ + IRPF в ES минус deducción por doble imposición.',
  },
  {
    title: 'Вычеты Испании при зарплате РФ',
    text: 'Mínimo personal y familiar уменьшает общую базу IRPF. SS работника — только на доход в Испании, не на зарплату российского работодателя.',
  },
  {
    title: 'Зарплата / доход в стране проживания (ES nómina, фриланс)',
    text: 'Налоги страны проживания (retenciones, IRPF, SS). Отдельный налог у источника не начисляется.',
  },
  {
    title: '«Не учитывать в налогах проживания»',
    text: 'Доход остаётся в денежном потоке, но не попадает в IRPF. Подходит для уже обложенного за рубежом дохода (упрощённо).',
  },
] as const

export interface DoubleTaxationLine {
  incomeId: string
  incomeName: string
  treatment: IncomeTaxTreatment
  label: string
}

const TREATMENT_LABELS: Record<IncomeTaxTreatment, string> = {
  residence: 'Налоги страны проживания',
  residence_with_credit: 'IRPF ES + зачёт НДФЛ РФ',
  source_russia: 'НДФЛ в России (источник)',
  excluded: 'Вне налогов проживания',
  none: 'Без налогообложения в модели',
}

export function buildDoubleTaxationLines(incomes: RecurringItem[]): DoubleTaxationLine[] {
  return incomes.map((item) => {
    const treatment = getIncomeTaxTreatment(item)
    return {
      incomeId: item.id,
      incomeName: item.name,
      treatment,
      label: TREATMENT_LABELS[treatment],
    }
  })
}
