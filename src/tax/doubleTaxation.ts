import type { RecurringItem } from '../types/budget'
import { isIncludedInResidenceTax, isRussiaSalary } from './incomeSourceTax'

/** Как облагается доход в модели избежания двойного налогообложения. */
export type IncomeTaxTreatment =
  | 'residence'
  | 'source_russia'
  | 'excluded'
  | 'none'

export function getIncomeTaxTreatment(item: RecurringItem): IncomeTaxTreatment {
  if (!isIncludedInResidenceTax(item)) {
    return isRussiaSalary(item) ? 'source_russia' : 'excluded'
  }
  if (isRussiaSalary(item)) {
    return 'residence'
  }
  return 'residence'
}

/** НДФЛ у источника в РФ — только если доход не перенесён в базу страны проживания. */
export function isRussiaSourceTaxable(item: RecurringItem): boolean {
  return isRussiaSalary(item) && !isIncludedInResidenceTax(item)
}

export const DOUBLE_TAXATION_RULES = [
  {
    title: 'Зарплата из России (по умолчанию)',
    text: 'НДФЛ удерживается в РФ. Доход исключён из IRPF страны проживания — двойного налогообложения нет.',
  },
  {
    title: 'Зарплата из России + «Учитывать в налогах проживания»',
    text: 'Доход облагается только в стране проживания (IRPF). НДФЛ в РФ в расчёте не применяется.',
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
