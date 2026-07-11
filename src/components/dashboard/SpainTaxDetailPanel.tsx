import { formatCurrency, formatPercent } from '../../lib/format'
import type { ScheduledTaxPayment, TaxBreakdownItem, TaxResult } from '../../tax/types'
import { Card } from '../ui/FormControls'

const SECTION_TITLES: Record<string, string> = {
  gross: 'Исходный доход',
  deduction: 'Вычеты из налоговой базы',
  base: 'Налоговая база',
  bracket: 'IRPF по ступеням',
  tax: 'Налоги',
  info: 'Дополнительно',
  total: 'Итог',
}

const SECTION_ORDER = ['gross', 'deduction', 'base', 'bracket', 'tax', 'info', 'total'] as const

function groupByKind(items: TaxBreakdownItem[]): Map<string, TaxBreakdownItem[]> {
  const map = new Map<string, TaxBreakdownItem[]>()
  for (const item of items) {
    const kind = item.kind ?? 'info'
    const list = map.get(kind) ?? []
    list.push(item)
    map.set(kind, list)
  }
  return map
}

function BreakdownRow({ item, currency }: { item: TaxBreakdownItem; currency: string }) {
  return (
    <li className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <div className="flex justify-between gap-4 text-sm">
        <span className="font-medium text-slate-700">{item.label}</span>
        <span className="shrink-0 font-semibold text-slate-900">
          {formatCurrency(item.amount, currency)}
        </span>
      </div>
      {item.description && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{item.description}</p>
      )}
      {item.formula && (
        <p className="mt-1 font-mono text-xs text-slate-600">{item.formula}</p>
      )}
    </li>
  )
}

function PaymentRow({
  payment,
  currency,
}: {
  payment: ScheduledTaxPayment
  currency: string
}) {
  const amount = payment.social + payment.incomeTax
  const dateLabel = `${payment.day} ${MONTH_SHORT[payment.month - 1]} ${payment.year ?? ''}`.trim()

  return (
    <li className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <div className="flex justify-between gap-4 text-sm">
        <span className="font-medium text-slate-700">
          {payment.label}
          <span className="ml-2 font-normal text-slate-500">{dateLabel}</span>
        </span>
        <span className="shrink-0 font-semibold text-slate-900">
          {formatCurrency(amount, currency)}
        </span>
      </div>
      {payment.description && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{payment.description}</p>
      )}
      {payment.formula && (
        <p className="mt-1 font-mono text-xs text-slate-600">{payment.formula}</p>
      )}
      {(payment.social > 0 || payment.incomeTax > 0) && (
        <p className="mt-1 text-xs text-slate-500">
          {payment.social > 0 && `SS: ${formatCurrency(payment.social, currency)}`}
          {payment.social > 0 && payment.incomeTax > 0 && ' · '}
          {payment.incomeTax > 0 && `IRPF: ${formatCurrency(payment.incomeTax, currency)}`}
        </p>
      )}
    </li>
  )
}

function collapseRecurringPayments(
  payments: ScheduledTaxPayment[],
  currency: string,
): ScheduledTaxPayment[] {
  const monthly = payments.filter((p) => p.day === 1 && p.social > 0 && p.incomeTax === 0)
  const other = payments.filter((p) => !(p.day === 1 && p.social > 0 && p.incomeTax === 0))

  if (monthly.length <= 1) return payments

  const first = monthly[0]
  const allSame = monthly.every((p) => p.social === first.social)
  if (!allSame) return payments

  return [
    {
      ...first,
      label: `${first.label} (12 раз в год)`,
      description: `Ежемесячно 1-го числа: ${first.description ?? 'cotización RETA'}`,
      formula: `${formatCurrency(first.social, currency)} × 12 = ${formatCurrency(first.social * 12, currency)}`,
    },
    ...other,
  ]
}

const MONTH_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
]

interface SpainTaxDetailPanelProps {
  title?: string
  regimeName: string
  regimeDescription?: string
  taxRegimeId?: string
  result: TaxResult
  currency: string
  paymentSchedule?: ScheduledTaxPayment[]
  quarterlyGross?: [number, number, number, number]
  embedded?: boolean
}

export function SpainTaxDetailPanel({
  title = 'Налоги Испании — подробная расшифровка',
  regimeName,
  regimeDescription,
  taxRegimeId,
  result,
  currency,
  paymentSchedule,
  quarterlyGross,
  embedded,
}: SpainTaxDetailPanelProps) {
  const isEmployed = taxRegimeId === 'es-employed'
  const panelTitle = isEmployed
    ? 'Налоги Испании — nómina (наёмный работник)'
    : title
  const grouped = groupByKind(result.breakdown)

  const inner = (
    <>
      {!embedded && <h2 className="mb-2 text-lg font-semibold">{panelTitle}</h2>}
      <p className="text-sm text-slate-500">
        Режим: <span className="font-medium text-slate-700">{regimeName}</span>
        {' · '}
        Эффективная ставка:{' '}
        <span className="font-medium text-slate-700">{formatPercent(result.effectiveRate)}</span>
      </p>
      {regimeDescription && (
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{regimeDescription}</p>
      )}

      <div className="mt-5 space-y-5">
        {SECTION_ORDER.map((kind) => {
          const items = grouped.get(kind)
          if (!items?.length) return null
          return (
            <section key={kind}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {SECTION_TITLES[kind]}
              </h3>
              <ul className="space-y-2">
                {items.map((item) => (
                  <BreakdownRow key={item.label} item={item} currency={currency} />
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      {quarterlyGross && taxRegimeId === 'es-standard' && (
        <section className="mt-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Доход по кварталам
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {quarterlyGross.map((amount, index) => (
              <li
                key={index}
                className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm"
              >
                <span className="text-slate-500">Q{index + 1}</span>
                <p className="font-semibold text-slate-900">{formatCurrency(amount, currency)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {paymentSchedule && paymentSchedule.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {isEmployed ? 'Удержания с nómina (оценка)' : 'График платежей (кассовый)'}
          </h3>
          <ul className="space-y-2">
            {collapseRecurringPayments(paymentSchedule, currency)
              .filter((p) => p.social > 0 || p.incomeTax > 0)
              .sort((a, b) => {
                const yearA = a.year ?? 0
                const yearB = b.year ?? 0
                if (yearA !== yearB) return yearA - yearB
                if (a.month !== b.month) return a.month - b.month
                return a.day - b.day
              })
              .map((payment) => (
                <PaymentRow
                  key={`${payment.year}-${payment.month}-${payment.day}-${payment.label}`}
                  payment={payment}
                  currency={currency}
                />
              ))}
          </ul>
        </section>
      )}
    </>
  )

  return embedded ? inner : <Card>{inner}</Card>
}
