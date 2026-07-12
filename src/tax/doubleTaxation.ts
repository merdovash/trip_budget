import type { RecurringItem } from '../types/budget'
import { isIncludedInResidenceTax, isRussiaSalary } from './incomeSourceTax'

/** Как облагается доход в модели избежания двойного налогообложения. */
export type IncomeTaxTreatment =
  | 'residence'
  | 'residence_with_credit'
  | 'source_russia'
  | 'excluded'
  | 'none'

export function isRussiaSalaryInResidenceBase(item: RecurringItem): boolean {
  return isRussiaSalary(item) && isIncludedInResidenceTax(item)
}

export function usesResidenceForeignTaxCredit(item: RecurringItem): boolean {
  return isRussiaSalaryInResidenceBase(item) && item.foreignTaxCredit !== false
}

export function getIncomeTaxTreatment(item: RecurringItem): IncomeTaxTreatment {
  if (!isIncludedInResidenceTax(item)) {
    return isRussiaSalary(item) ? 'source_russia' : 'excluded'
  }
  if (isRussiaSalaryInResidenceBase(item)) {
    return usesResidenceForeignTaxCredit(item) ? 'residence_with_credit' : 'residence'
  }
  return 'residence'
}

/** НДФЛ у источника в РФ — если доход не в декларации или включён с зачётом. */
export function isRussiaSourceTaxable(item: RecurringItem): boolean {
  if (!isRussiaSalary(item)) return false
  if (!isIncludedInResidenceTax(item)) return true
  return usesResidenceForeignTaxCredit(item)
}

export const SPAIN_DOUBLE_TAXATION_RULES = [
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

export const THAILAND_DOUBLE_TAXATION_RULES = [
  {
    title: 'Зарплата из России (по умолчанию)',
    text: 'НДФЛ удерживается в РФ. Доход исключён из PIT Таиланда — двойного налогообложения нет, если деньги не включены в декларацию.',
  },
  {
    title: 'Remittance rule (Por. 161/2566, с 2024)',
    text: 'Иностранный доход облагается в Таиланде при переводе в страну, если он заработан в год вашего резидентства (180+ дней). Доход до 01.01.2024 и доход в годы нерезидентства — вне PIT.',
  },
  {
    title: 'Зарплата РФ + «Учитывать в налогах проживания»',
    text: 'Доход в тайской декларации: вычеты 50%/฿100k, personal ฿60k, spouse ฿60k, дети ฿30k. С зачётом НДФЛ — кредит по договору РФ–Таиланд (упрощ.).',
  },
  {
    title: 'Зарплата / доход в Таиланде',
    text: 'PIT по прогрессивной шкале + SSO 5% (режим «Наёмный работник») только на локальную зарплату.',
  },
  {
    title: '«Не учитывать в налогах проживания»',
    text: 'Доход в денежном потоке, но вне PIT. Подходит для зарплаты РФ без remittance в декларацию.',
  },
] as const

export const GEORGIA_DOUBLE_TAXATION_RULES = [
  {
    title: 'Зарплата из России (по умолчанию)',
    text: 'НДФЛ удерживается в РФ. Доход исключён из PIT Грузии — двойного налогообложения нет.',
  },
  {
    title: 'Резидентство в Грузии',
    text: '183+ дней в календарном году или центр жизненных интересов. Резиденты облагаются с мирового дохода: PIT 20% (или 1% по статусу малого бизнеса / Virtual Zone).',
  },
  {
    title: 'Зарплата РФ + «Учитывать в налогах проживания»',
    text: 'Доход в грузинской декларации как часть мирового дохода. С зачётом НДФЛ — кредит по договору РФ–Грузия (упрощ.). Пенсионный взнос 2% — только на зарплату от работодателя в GE.',
  },
  {
    title: 'Статус малого бизнеса (1%)',
    text: 'ИП со статусом малого бизнеса платит 1% с валового оборота (лимит 500 000 GEL в год). Подходит для фриланса и удалённой работы как ИП.',
  },
  {
    title: '«Не учитывать в налогах проживания»',
    text: 'Доход в денежном потоке, но вне PIT Грузии. Подходит для зарплаты РФ без включения в декларацию.',
  },
] as const

export const DOUBLE_TAXATION_RULES = SPAIN_DOUBLE_TAXATION_RULES

export function getDoubleTaxationRules(countryCode: string): readonly { title: string; text: string }[] {
  if (countryCode === 'TH') return THAILAND_DOUBLE_TAXATION_RULES
  if (countryCode === 'GE') return GEORGIA_DOUBLE_TAXATION_RULES
  return SPAIN_DOUBLE_TAXATION_RULES
}

export interface DoubleTaxationLine {
  incomeId: string
  incomeName: string
  treatment: IncomeTaxTreatment
  label: string
}

export function getTreatmentLabel(
  treatment: IncomeTaxTreatment,
  countryCode = 'ES',
): string {
  switch (treatment) {
    case 'residence':
      return 'Налоги страны проживания'
    case 'residence_with_credit':
      if (countryCode === 'TH') return 'PIT TH + зачёт НДФЛ РФ'
      if (countryCode === 'GE') return 'PIT GE + зачёт НДФЛ РФ'
      return 'IRPF ES + зачёт НДФЛ РФ'
    case 'source_russia':
      return 'НДФЛ в России (источник)'
    case 'excluded':
      return 'Вне налогов проживания'
    case 'none':
      return 'Без налогообложения в модели'
  }
}

export function buildDoubleTaxationLines(
  incomes: RecurringItem[],
  countryCode = 'ES',
): DoubleTaxationLine[] {
  return incomes.map((item) => {
    const treatment = getIncomeTaxTreatment(item)
    return {
      incomeId: item.id,
      incomeName: item.name,
      treatment,
      label: getTreatmentLabel(treatment, countryCode),
    }
  })
}
