import type {
  BracketTaxLine,
  TaxBreakdownItem,
  TaxCalculator,
  TaxInput,
  TaxResult,
  TaxScheduleContext,
  ScheduledTaxPayment,
  TaxBracket,
} from '../types'
import { breakdownProgressiveTax, buildTaxResult } from '../types'

/** Прогрессивная шкала IRPF (государственная + типичная автономная, упрощённо). */
export const SPAIN_IRPF_BRACKETS: TaxBracket[] = [
  { upTo: 12_450, rate: 0.19 },
  { upTo: 20_200, rate: 0.24 },
  { upTo: 35_200, rate: 0.3 },
  { upTo: 60_000, rate: 0.37 },
  { upTo: 300_000, rate: 0.45 },
  { upTo: null, rate: 0.47 },
]

/** Cotización Seguridad Social — работник (доля работника, ~6,35%). */
export const SPAIN_EMPLOYEE_SS_RATE = 0.0635
/** Взносы работодателя (информ., упрощённо ~29,9%). */
export const SPAIN_EMPLOYER_SS_RATE = 0.299
export const SPAIN_SS_ANNUAL_CAP = 58_914

/** Autónomo / digital nomad — упрощённые константы. */
export const SPAIN_NOMAD_EXPENSE_DEDUCTION = 0.3
export const SPAIN_NOMAD_PREPAYMENT_RATE = 0.2
export const SPAIN_PERSONAL_ALLOWANCE = 5_550
export const SPAIN_DEPENDENT_ALLOWANCE = 2_400

const MONTH_NAMES = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

function personalAllowance(input: TaxInput): number {
  return SPAIN_PERSONAL_ALLOWANCE + input.dependents * SPAIN_DEPENDENT_ALLOWANCE
}

function formatEuro(amount: number): string {
  return `€${Math.round(amount).toLocaleString('ru-RU')}`
}

export function formatIrpfBracketRange(from: number, to: number | null): string {
  if (to === null) return `свыше ${formatEuro(from)}`
  return `${formatEuro(from)} – ${formatEuro(to)}`
}

function bracketBreakdownItems(lines: BracketTaxLine[]): TaxBreakdownItem[] {
  return lines.map((line) => ({
    label: `Ступень ${formatIrpfBracketRange(line.from, line.to)}`,
    amount: line.tax,
    description: `Налогооблагаемый доход в ступени: ${formatEuro(line.taxableInBracket)}`,
    formula: `${formatEuro(line.taxableInBracket)} × ${(line.rate * 100).toFixed(0)}% = ${formatEuro(line.tax)}`,
    kind: 'bracket' as const,
  }))
}

export function getAutonomoMonthlyCuota(annualGross: number): number {
  const monthlyGross = annualGross / 12
  if (monthlyGross < 1_300) return 230
  if (monthlyGross < 1_700) return 260
  if (monthlyGross < 3_000) return 294
  if (monthlyGross < 5_000) return 350
  return 420
}

function getAutonomoCuotaTramoLabel(annualGross: number): string {
  const monthlyGross = annualGross / 12
  if (monthlyGross < 1_300) return 'доход < €1 300/мес.'
  if (monthlyGross < 1_700) return '€1 300 – €1 700/мес.'
  if (monthlyGross < 3_000) return '€1 700 – €3 000/мес.'
  if (monthlyGross < 5_000) return '€3 000 – €5 000/мес.'
  return 'доход > €5 000/мес.'
}

function getEmployerSocialContributions(gross: number): number {
  return Math.min(gross, SPAIN_SS_ANNUAL_CAP) * SPAIN_EMPLOYER_SS_RATE
}

/** Сотрудник: SS уменьшает базу IRPF, затем прогрессивная шкала. */
export function calculateSpainEmployeeTax(input: TaxInput): TaxResult {
  const gross = input.grossAnnualIncome
  const ssBase = Math.min(gross, SPAIN_SS_ANNUAL_CAP)
  const socialContributions = ssBase * SPAIN_EMPLOYEE_SS_RATE
  const employerSocial = getEmployerSocialContributions(gross)
  const allowances = personalAllowance(input)
  const taxableBase = Math.max(0, gross - socialContributions - allowances)
  const bracketLines = breakdownProgressiveTax(taxableBase, SPAIN_IRPF_BRACKETS)
  const incomeTax = bracketLines.reduce((sum, line) => sum + line.tax, 0)
  const monthlySS = socialContributions / 12
  const monthlyIRPF = incomeTax / 12
  const monthlyNet = (gross - incomeTax - socialContributions) / 12

  const breakdown: TaxBreakdownItem[] = [
    {
      label: 'Валовой доход (bruto anual)',
      amount: gross,
      description:
        'Годовая сумма по nómina: bruto до удержаний IRPF и взносов работника в Seguridad Social.',
      kind: 'gross',
    },
    {
      label: 'Соцвзносы работника (Seguridad Social)',
      amount: socialContributions,
      description:
        'Cuota obrera (~6,35%): уменьшает базу IRPF (Art. 19 Ley 35/2006). Удерживается работодателем из bruto.',
      formula: `min(${formatEuro(gross)}, ${formatEuro(SPAIN_SS_ANNUAL_CAP)}) × ${(SPAIN_EMPLOYEE_SS_RATE * 100).toFixed(2)}% = ${formatEuro(socialContributions)}`,
      kind: 'deduction',
    },
    {
      label: 'Mínimo personal y familiar',
      amount: allowances,
      description:
        'Минимум личный и семейный вычет (Art. 57 Ley IRPF). Снижает базу, не возвращается наличными.',
      formula:
        input.dependents > 0
          ? `${formatEuro(SPAIN_PERSONAL_ALLOWANCE)} + ${input.dependents} × ${formatEuro(SPAIN_DEPENDENT_ALLOWANCE)} = ${formatEuro(allowances)}`
          : `${formatEuro(SPAIN_PERSONAL_ALLOWANCE)}`,
      kind: 'deduction',
    },
    {
      label: 'Налоговая база IRPF',
      amount: taxableBase,
      description: 'База после cuota obrera и mínimo personal — к ней применяется прогрессивная шкала.',
      formula: `${formatEuro(gross)} − ${formatEuro(socialContributions)} − ${formatEuro(allowances)} = ${formatEuro(taxableBase)}`,
      kind: 'base',
    },
    ...bracketBreakdownItems(bracketLines),
    {
      label: 'Retención IRPF (год)',
      amount: incomeTax,
      description:
        'Сумма IRPF по ступеням. Удерживается ежемесячно с nómina (retención a cuenta).',
      kind: 'tax',
    },
    {
      label: 'Cuota obrera SS (год)',
      amount: socialContributions,
      description: 'Годовая сумма взносов работника — удерживается из bruto вместе с IRPF.',
      kind: 'tax',
    },
    {
      label: 'Retención IRPF (среднемесячно)',
      amount: monthlyIRPF,
      description: 'Оценка удержания IRPF с одной nómina при равном bruto по месяцам.',
      formula: `${formatEuro(incomeTax)} / 12 = ${formatEuro(monthlyIRPF)}`,
      kind: 'info',
    },
    {
      label: 'Cuota obrera SS (среднемесячно)',
      amount: monthlySS,
      description: 'Удержание взноса работника с каждой выплаты.',
      formula: `${formatEuro(socialContributions)} / 12 = ${formatEuro(monthlySS)}`,
      kind: 'info',
    },
    {
      label: 'Neto mensual (оценка)',
      amount: monthlyNet,
      description: 'Bruto − IRPF − cuota obrera, среднее «на руки» в месяц.',
      formula: `(${formatEuro(gross)} − ${formatEuro(incomeTax)} − ${formatEuro(socialContributions)}) / 12 = ${formatEuro(monthlyNet)}`,
      kind: 'info',
    },
    {
      label: 'Cuota patronal SS (информ., год)',
      amount: employerSocial,
      description:
        'Взносы работодателя (~29,9%, упрощ.). Не удерживаются из зарплаты, но влияют на полную стоимость найма.',
      formula: `min(${formatEuro(gross)}, ${formatEuro(SPAIN_SS_ANNUAL_CAP)}) × ${(SPAIN_EMPLOYER_SS_RATE * 100).toFixed(1)}% = ${formatEuro(employerSocial)}`,
      kind: 'info',
    },
    {
      label: 'Neto anual (на руки)',
      amount: gross - incomeTax - socialContributions,
      description: 'Bruto − retención IRPF − cuota obrera SS.',
      formula: `${formatEuro(gross)} − ${formatEuro(incomeTax)} − ${formatEuro(socialContributions)}`,
      kind: 'total',
    },
  ]

  return buildTaxResult(gross, incomeTax, socialContributions, breakdown, bracketLines)
}

export interface SpainSalaryPaymentDisplay {
  id?: string
  gross: number
  social: number
  irpf: number
  net: number
  dayOfMonth?: number
}

export interface SpainSalaryMonthlyDisplay {
  byId: Record<string, SpainSalaryPaymentDisplay>
  payments: SpainSalaryPaymentDisplay[]
  totalGross: number
  totalSocial: number
  totalIrpf: number
  totalNet: number
  employerSocialMonthly: number
}

/** Помесячный расчёт nómina для формы дохода (пропорциональное распределение годового IRPF/SS). */
export function calculateSpainSalaryMonthlyDisplay(
  payments: { id?: string; amount: number; dayOfMonth?: number }[],
  dependents: number,
): SpainSalaryMonthlyDisplay | null {
  const totalGross = payments.reduce((sum, p) => sum + p.amount, 0)
  if (totalGross <= 0) return null

  const annual = calculateSpainEmployeeTax({
    grossAnnualIncome: totalGross * 12,
    familySize: 2,
    dependents,
  })
  const sorted = [...payments].sort(
    (a, b) => (a.dayOfMonth ?? 1) - (b.dayOfMonth ?? 1),
  )

  const resultPayments: SpainSalaryPaymentDisplay[] = sorted.map((payment) => {
    const share = payment.amount / totalGross
    const social = (annual.socialContributions / 12) * share
    const irpf = (annual.incomeTax / 12) * share
    return {
      id: payment.id,
      gross: payment.amount,
      social,
      irpf,
      net: payment.amount - social - irpf,
      dayOfMonth: payment.dayOfMonth,
    }
  })

  const byId = Object.fromEntries(
    resultPayments.filter((p) => p.id).map((p) => [p.id!, p]),
  )

  return {
    byId,
    payments: resultPayments,
    totalGross,
    totalSocial: resultPayments.reduce((sum, p) => sum + p.social, 0),
    totalIrpf: resultPayments.reduce((sum, p) => sum + p.irpf, 0),
    totalNet: resultPayments.reduce((sum, p) => sum + p.net, 0),
    employerSocialMonthly: getEmployerSocialContributions(totalGross * 12) / 12,
  }
}

/** Ежемесячные retenciones с nómina (для детализации, не modelo 130). */
export function buildSpainEmployeeSchedule(
  input: TaxInput,
  context: TaxScheduleContext,
): ScheduledTaxPayment[] {
  const result = calculateSpainEmployeeTax(input)
  const monthlySS = result.socialContributions / 12
  const monthlyIRPF = result.incomeTax / 12

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    return {
      month,
      day: 28,
      year: context.year,
      social: monthlySS,
      incomeTax: monthlyIRPF,
      label: 'Retenciones nómina',
      description:
        'Удержание cuota obrera SS и retención IRPF с bruto при выплате nómina (оценка).',
      formula: `SS ${formatEuro(monthlySS)} + IRPF ${formatEuro(monthlyIRPF)} = ${formatEuro(monthlySS + monthlyIRPF)}`,
    }
  })
}

/** Autónomo / digital nomad: расходы 30%, SS как вычет, IRPF по шкале. */
export function calculateSpainDigitalNomadTax(input: TaxInput): TaxResult {
  const gross = input.grossAnnualIncome
  const monthlyCuota = getAutonomoMonthlyCuota(gross)
  const socialContributions = monthlyCuota * 12
  const professionalExpenses = gross * SPAIN_NOMAD_EXPENSE_DEDUCTION
  const allowances = personalAllowance(input)
  const taxableBase = Math.max(0, gross - professionalExpenses - socialContributions - allowances)
  const bracketLines = breakdownProgressiveTax(taxableBase, SPAIN_IRPF_BRACKETS)
  const incomeTax = bracketLines.reduce((sum, line) => sum + line.tax, 0)
  const quarterlyPrepayments = taxableBase * SPAIN_NOMAD_PREPAYMENT_RATE

  const breakdown: TaxBreakdownItem[] = [
    {
      label: 'Валовой доход (facturación)',
      amount: gross,
      description: 'Годовой доход autónomo / фрилансера, облагаемый IRPF.',
      kind: 'gross',
    },
    {
      label: 'Профессиональные расходы (gastos deducibles)',
      amount: professionalExpenses,
      description:
        'Упрощённая оценка вычитаемых расходов (30% от оборота). В реальности — фактические gastos по modelo 100.',
      formula: `${formatEuro(gross)} × ${(SPAIN_NOMAD_EXPENSE_DEDUCTION * 100).toFixed(0)}% = ${formatEuro(professionalExpenses)}`,
      kind: 'deduction',
    },
    {
      label: 'Cotización Seguridad Social (autónomo)',
      amount: socialContributions,
      description:
        'Ежемесячный взнос autónomo уменьшает базу IRPF. Тариф по трамо дохода (RETA, упрощённо).',
      formula: `${formatEuro(monthlyCuota)}/мес. × 12 = ${formatEuro(socialContributions)} (${getAutonomoCuotaTramoLabel(gross)})`,
      kind: 'deduction',
    },
    {
      label: 'Mínimo personal y familiar',
      amount: allowances,
      description: 'Минимум личный и семейный вычет (Art. 57 Ley IRPF).',
      formula:
        input.dependents > 0
          ? `${formatEuro(SPAIN_PERSONAL_ALLOWANCE)} + ${input.dependents} × ${formatEuro(SPAIN_DEPENDENT_ALLOWANCE)} = ${formatEuro(allowances)}`
          : `${formatEuro(SPAIN_PERSONAL_ALLOWANCE)}`,
      kind: 'deduction',
    },
    {
      label: 'Налоговая база IRPF',
      amount: taxableBase,
      description: 'База после профессиональных расходов, соцвзносов и mínimo personal.',
      formula: `${formatEuro(gross)} − ${formatEuro(professionalExpenses)} − ${formatEuro(socialContributions)} − ${formatEuro(allowances)} = ${formatEuro(taxableBase)}`,
      kind: 'base',
    },
    ...bracketBreakdownItems(bracketLines),
    {
      label: 'IRPF итого (год, оценка)',
      amount: incomeTax,
      description:
        'Годовой налог по прогрессивной шкале. Фактическая декларарация — modelo 100 (апр–июн следующего года).',
      kind: 'tax',
    },
    {
      label: 'Авансы modelo 130 (4 квартала)',
      amount: quarterlyPrepayments,
      description:
        'Квартальные платежи 20% от прибыли квартала (Art. 110.3 RIRPF). Срок: 1–20 апр, июл, окт, янв.',
      formula: `${formatEuro(taxableBase)} × ${(SPAIN_NOMAD_PREPAYMENT_RATE * 100).toFixed(0)}% = ${formatEuro(quarterlyPrepayments)} (сумма за год, упрощ.)`,
      kind: 'info',
    },
    {
      label: 'Соцвзносы итого (год, касса)',
      amount: socialContributions,
      description: 'Ежемесячная cotización autónomo, 1-го числа каждого месяца.',
      kind: 'tax',
    },
    {
      label: 'Чистый доход после налогов',
      amount: gross - incomeTax - socialContributions,
      description: 'Оценка после IRPF и соцвзносов autónomo (без учёта авансов modelo 130 как отдельного резерва).',
      formula: `${formatEuro(gross)} − ${formatEuro(incomeTax)} − ${formatEuro(socialContributions)}`,
      kind: 'total',
    },
  ]

  return buildTaxResult(gross, incomeTax, socialContributions, breakdown, bracketLines)
}

/** Квартальные авансы IRPF (1–20 апр/июл/окт/янв) + ежемесячные соцвзносы. */
export function buildSpainDigitalNomadSchedule(
  input: TaxInput,
  context: TaxScheduleContext,
): ScheduledTaxPayment[] {
  const payments: ScheduledTaxPayment[] = []
  const monthlySS = getAutonomoMonthlyCuota(input.grossAnnualIncome)
  const allowancePerQuarter = personalAllowance(input) / 4

  for (let month = 1; month <= 12; month++) {
    payments.push({
      month,
      day: 1,
      year: context.year,
      social: monthlySS,
      incomeTax: 0,
      label: 'Cotización autónomo (ежемесячно)',
    })
  }

  const prepaymentDates: Array<{ month: number; day: number; quarter: number; yearOffset: number }> =
    [
      { month: 4, day: 20, quarter: 0, yearOffset: 0 },
      { month: 7, day: 20, quarter: 1, yearOffset: 0 },
      { month: 10, day: 20, quarter: 2, yearOffset: 0 },
      { month: 1, day: 20, quarter: 3, yearOffset: 1 },
    ]

  for (const slot of prepaymentDates) {
    const quarterGross = context.quarterlyGross[slot.quarter]
    const quarterExpenses = quarterGross * SPAIN_NOMAD_EXPENSE_DEDUCTION
    const quarterSS = monthlySS * 3
    const quarterTaxable = Math.max(
      0,
      quarterGross - quarterExpenses - quarterSS - allowancePerQuarter,
    )
    const prepayment = quarterTaxable * SPAIN_NOMAD_PREPAYMENT_RATE
    if (prepayment <= 0) continue

    const paymentYear = context.year + slot.yearOffset
    payments.push({
      month: slot.month,
      day: slot.day,
      year: paymentYear,
      social: 0,
      incomeTax: prepayment,
      label: `Modelo 130, Q${slot.quarter + 1} ${paymentYear}`,
      formula: `(${formatEuro(quarterGross)} − ${formatEuro(quarterExpenses)} − ${formatEuro(quarterSS)} − ${formatEuro(allowancePerQuarter)}) × 20% = ${formatEuro(prepayment)}`,
      description: `Доход Q${slot.quarter + 1}: ${formatEuro(quarterGross)}. Срок: до 20 ${MONTH_NAMES[slot.month - 1]} ${paymentYear}.`,
    })
  }

  return payments
}

export const spainEmployed: TaxCalculator = {
  id: 'es-employed',
  countryCode: 'ES',
  name: 'IRPF (наёмный работник / nómina)',
  description:
    'Digital nomad по контракту с испанским работодателем: cuota obrera SS (~6,35%) уменьшает базу IRPF, retención удерживается с bruto ежемесячно. Без modelo 130.',
  taxDistribution: 'with_income',
  calculate: calculateSpainEmployeeTax,
  buildTaxSchedule: (input, _result, context) => buildSpainEmployeeSchedule(input, context),
}

export const spainStandard: TaxCalculator = {
  id: 'es-standard',
  countryCode: 'ES',
  name: 'IRPF (autónomo / фриланс)',
  description:
    'Autónomo: gastos deducibles, cotización RETA, прогрессивный IRPF, авансы modelo 130 ежеквартально (20%).',
  taxDistribution: 'scheduled',
  calculate: calculateSpainDigitalNomadTax,
  buildTaxSchedule: (input, _result, context) => buildSpainDigitalNomadSchedule(input, context),
}

export const spainBeckham: TaxCalculator = {
  id: 'es-beckham',
  countryCode: 'ES',
  name: 'Beckham Law (упрощ.)',
  description: 'Фиксированная ставка 24% на доход до €600 000 для новых резидентов (упрощённая модель).',
  taxDistribution: 'with_income',
  calculate(input: TaxInput) {
    const threshold = 600_000
    const gross = input.grossAnnualIncome
    const taxedAt24 = Math.min(gross, threshold)
    const taxedAt47 = Math.max(0, gross - threshold)
    const incomeTax = taxedAt24 * 0.24 + taxedAt47 * 0.47

    const breakdown: TaxBreakdownItem[] = [
      {
        label: 'Валовой доход',
        amount: gross,
        description: 'Доход, облагаемый по режиму Beckham Law (Ley 35/2006, Art. 93, упрощ.).',
        kind: 'gross',
      },
      {
        label: 'Налог по ставке 24%',
        amount: taxedAt24 * 0.24,
        description: 'Фиксированная ставка для квалифицированных новых резидентов (до €600 000).',
        formula:
          taxedAt47 > 0
            ? `${formatEuro(taxedAt24)} × 24% = ${formatEuro(taxedAt24 * 0.24)}`
            : `${formatEuro(gross)} × 24% = ${formatEuro(incomeTax)}`,
        kind: 'tax',
      },
    ]

    if (taxedAt47 > 0) {
      breakdown.push({
        label: 'Налог по ставке 47% (свыше €600 000)',
        amount: taxedAt47 * 0.47,
        description: 'Часть дохода свыше порога облагается по максимальной ставке.',
        formula: `${formatEuro(taxedAt47)} × 47% = ${formatEuro(taxedAt47 * 0.47)}`,
        kind: 'tax',
      })
    }

    breakdown.push({
      label: 'IRPF итого',
      amount: incomeTax,
      description: 'Beckham Law: без стандартных вычетов mínimo personal в этой упрощённой модели.',
      kind: 'total',
    })

    return buildTaxResult(gross, incomeTax, 0, breakdown)
  },
}
