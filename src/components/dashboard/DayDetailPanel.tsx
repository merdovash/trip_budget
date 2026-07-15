import { formatCurrency, formatDateDisplay } from '../../lib/format'
import type { DayLedger, DayLedgerLine } from '../../engine/budgetEngine'
import { StackPanel } from '../ui/StackPanel'

interface DayDetailPanelProps {
  open: boolean
  ledger: DayLedger | null
  currency: string
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}

function kindLabel(kind: DayLedgerLine['kind']): string {
  switch (kind) {
    case 'loan_payment':
      return 'Кредит'
    case 'loan_disbursement':
      return 'Выдача кредита'
    case 'food':
      return 'Еда'
    case 'once':
      return 'Разовый'
    case 'income':
      return 'Доход'
    default:
      return 'Расход'
  }
}

function LineList({
  title,
  lines,
  currency,
  tone,
}: {
  title: string
  lines: DayLedgerLine[]
  currency: string
  tone: 'income' | 'expense' | 'inflow'
}) {
  if (lines.length === 0) {
    return (
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
        <p className="text-sm text-slate-400">Нет статей</p>
      </section>
    )
  }

  const amountClass =
    tone === 'expense' ? 'text-red-700' : tone === 'income' ? 'text-emerald-700' : 'text-sky-700'

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{line.name}</p>
              <p className="text-xs text-slate-500">
                {kindLabel(line.kind)}
                {line.detail ? ` · ${line.detail}` : ''}
                {line.currency !== currency
                  ? ` · ${formatCurrency(line.amountOriginal, line.currency)}`
                  : ''}
              </p>
            </div>
            <span className={`shrink-0 font-semibold tabular-nums ${amountClass}`}>
              {tone === 'expense' ? '−' : '+'}
              {formatCurrency(line.amountInBase, currency)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function DayDetailPanel({
  open,
  ledger,
  currency,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onClose,
}: DayDetailPanelProps) {
  const title = ledger ? formatDateDisplay(ledger.date) : 'День'

  return (
    <StackPanel open={open} title={title} onClose={onClose}>
      {ledger && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={onPrev}
              disabled={!canPrev}
            >
              ← Пред. день
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={onNext}
              disabled={!canNext}
            >
              След. день →
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
            <div className="rounded-lg bg-emerald-50 px-2 py-2">
              <p className="text-emerald-800/70">Доходы</p>
              <p className="font-semibold text-emerald-800">
                {formatCurrency(ledger.incomeTotal, currency)}
              </p>
            </div>
            <div className="rounded-lg bg-red-50 px-2 py-2">
              <p className="text-red-800/70">Расходы</p>
              <p className="font-semibold text-red-800">
                {formatCurrency(ledger.expenseTotal, currency)}
              </p>
            </div>
            <div className="rounded-lg bg-sky-50 px-2 py-2">
              <p className="text-sky-800/70">Притоки</p>
              <p className="font-semibold text-sky-800">
                {formatCurrency(ledger.inflowTotal, currency)}
              </p>
            </div>
          </div>

          <LineList title="Доходы" lines={ledger.incomes} currency={currency} tone="income" />
          <LineList title="Расходы" lines={ledger.expenses} currency={currency} tone="expense" />
          {ledger.inflows.length > 0 && (
            <LineList
              title="Притоки (кредиты)"
              lines={ledger.inflows}
              currency={currency}
              tone="inflow"
            />
          )}
        </div>
      )}
    </StackPanel>
  )
}
