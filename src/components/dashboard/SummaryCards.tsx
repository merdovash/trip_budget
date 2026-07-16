import { formatCurrency, formatPercent } from '../../lib/format'
import { computeSummaryAverages } from '../../engine/budgetEngine'
import type { DailySnapshot, MonthlySnapshot } from '../../types/budget'
import { Card } from '../ui/FormControls'
import type { ReactNode } from 'react'

interface SummaryCardsProps {
  snapshots: MonthlySnapshot[]
  dailySnapshots: DailySnapshot[]
  currency: string
  annualTaxes: number
  initialBalance: number
}

function WalletIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M1 4.25A2.25 2.25 0 0 1 3.25 2h11.5A2.25 2.25 0 0 1 17 4.25v.918a2.752 2.752 0 0 0-.752-.168H3.25c-.384 0-.752.062-1.096.177V4.25ZM1 7.083V15.75A2.25 2.25 0 0 0 3.25 18h13.5A2.25 2.25 0 0 0 19 15.75v-5.5A2.25 2.25 0 0 0 16.75 8H3.25a.75.75 0 0 1 0-1.5h13.5c.192 0 .378.024.558.07A2.25 2.25 0 0 0 16.75 4.5H3.25A2.25 2.25 0 0 0 1 6.75v.333ZM16 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
    </svg>
  )
}

function InflowIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path
        fillRule="evenodd"
        d="M5.22 14.78a.75.75 0 0 0 1.06 0l7.22-7.22v5.69a.75.75 0 0 0 1.5 0v-7.5a.75.75 0 0 0-.75-.75h-7.5a.75.75 0 0 0 0 1.5h5.69l-7.22 7.22a.75.75 0 0 0 0 1.06Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function OutflowIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path
        fillRule="evenodd"
        d="M14.78 5.22a.75.75 0 0 0-1.06 0L6.5 12.44V6.75a.75.75 0 0 0-1.5 0v7.5c0 .414.336.75.75.75h7.5a.75.75 0 0 0 0-1.5H7.56l7.22-7.22a.75.75 0 0 0 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function TaxIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path
        fillRule="evenodd"
        d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm5.25 6.75a.75.75 0 0 0-1.5 0v2.19l-.72-.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l2-2a.75.75 0 1 0-1.06-1.06l-.72.72V8.75Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 16.5 2h-1ZM9.5 6A1.5 1.5 0 0 0 8 7.5v9A1.5 1.5 0 0 0 9.5 18h1a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 10.5 6h-1ZM3.5 10A1.5 1.5 0 0 0 2 11.5v5A1.5 1.5 0 0 0 3.5 18h1A1.5 1.5 0 0 0 6 16.5v-5A1.5 1.5 0 0 0 4.5 10h-1Z" />
    </svg>
  )
}

export function SummaryCards({
  snapshots,
  dailySnapshots,
  currency,
  annualTaxes,
  initialBalance,
}: SummaryCardsProps) {
  const { avgInflow, avgExpenses } = computeSummaryAverages(snapshots)
  const lastBalance = snapshots.at(-1)?.cumulativeBalance ?? 0
  const minDailyBalance =
    dailySnapshots.length > 0
      ? Math.min(...dailySnapshots.map((d) => d.cumulativeBalance))
      : initialBalance

  const cards: Array<{
    label: string
    value: string
    icon: ReactNode
    hint?: string
    warn?: boolean
  }> = [
    {
      label: 'Начальный остаток',
      value: formatCurrency(initialBalance, currency),
      icon: <WalletIcon />,
    },
    {
      label: 'Средний приток / мес.',
      value: formatCurrency(avgInflow, currency),
      hint: 'Чистый доход + выдача кредитов за горизонт / число месяцев',
      icon: <InflowIcon />,
    },
    {
      label: 'Средние расходы / мес.',
      value: formatCurrency(avgExpenses, currency),
      hint: 'Регулярные (с учётом дат начала/конца), разовые и платежи по кредитам',
      icon: <OutflowIcon />,
    },
    {
      label: 'Налоги / год',
      value: formatCurrency(annualTaxes, currency),
      icon: <TaxIcon />,
    },
    {
      label: 'Мин. баланс (по дням)',
      value: formatCurrency(minDailyBalance, currency),
      warn: minDailyBalance < 0,
      icon: <AlertIcon />,
    },
    {
      label: 'Баланс на конец периода',
      value: formatCurrency(lastBalance, currency),
      icon: <ChartIcon />,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.label}>
          <p className="text-sm text-slate-500">{card.label}</p>
          <div
            className={`mt-2 flex items-center gap-2 text-2xl font-semibold ${card.warn ? 'text-red-600' : 'text-slate-900'}`}
          >
            <span className={card.warn ? 'text-red-500' : 'text-slate-400'}>{card.icon}</span>
            <span>{card.value}</span>
          </div>
          {card.hint && (
            <p className="mt-1 text-xs leading-snug text-slate-400">{card.hint}</p>
          )}
        </Card>
      ))}
    </div>
  )
}

interface TaxBreakdownProps {
  title?: string
  regimeName: string
  effectiveRate: number
  breakdown: { label: string; amount: number; description?: string; formula?: string }[]
  currency: string
  footer?: string
  embedded?: boolean
}

export function TaxBreakdown({
  title = 'Налоговая детализация',
  regimeName,
  effectiveRate,
  breakdown,
  currency,
  footer,
  embedded,
}: TaxBreakdownProps) {
  const hasDetails = breakdown.some((item) => item.description || item.formula)

  const inner = (
    <>
      {!embedded && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
      <p className="text-sm text-slate-500">
        Режим: <span className="font-medium text-slate-700">{regimeName}</span> · Эффективная
        ставка: <span className="font-medium text-slate-700">{formatPercent(effectiveRate)}</span>
      </p>
      <ul className={`mt-4 space-y-2 ${hasDetails ? '' : ''}`}>
        {breakdown.map((item) => (
          <li
            key={item.label}
            className={hasDetails ? 'rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2' : ''}
          >
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">{item.label}</span>
              <span className="font-medium">{formatCurrency(item.amount, currency)}</span>
            </div>
            {item.description && (
              <p className="mt-1 text-xs text-slate-500">{item.description}</p>
            )}
            {item.formula && (
              <p className="mt-0.5 font-mono text-xs text-slate-600">{item.formula}</p>
            )}
          </li>
        ))}
      </ul>
      {footer && <p className="mt-3 text-xs text-slate-500">{footer}</p>}
    </>
  )

  return embedded ? inner : <Card>{inner}</Card>
}
