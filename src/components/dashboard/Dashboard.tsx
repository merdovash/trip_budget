import { useMemo } from 'react'
import {
  calculateBudgetProjection,
  calculateDailyBudgetProjection,
  findCashGapDays,
  getInitialBalanceInBase,
  getTaxSummary,
} from '../../engine/budgetEngine'
import { formatCurrency, formatDateDisplay } from '../../lib/format'
import { useBudgetStore } from '../../store/budgetStore'
import { useExchangeRateStore } from '../../store/exchangeRateStore'
import { EmptyState } from '../ui/FormControls'
import { CashFlowChart } from './CashFlowChart'
import { MonthlyTable } from './MonthlyTable'
import { SummaryCards, TaxBreakdown } from './SummaryCards'

export function Dashboard() {
  const settings = useBudgetStore((s) => s.settings)
  const incomes = useBudgetStore((s) => s.incomes)
  const expenses = useBudgetStore((s) => s.expenses)
  const oneTimeExpenses = useBudgetStore((s) => s.oneTimeExpenses)
  const rateDate = useExchangeRateStore((s) => s.rateDate)

  const snapshots = useMemo(
    () => calculateBudgetProjection(incomes, expenses, oneTimeExpenses, settings),
    [incomes, expenses, oneTimeExpenses, settings, rateDate],
  )

  const dailySnapshots = useMemo(
    () => calculateDailyBudgetProjection(incomes, expenses, oneTimeExpenses, settings),
    [incomes, expenses, oneTimeExpenses, settings, rateDate],
  )

  const cashGapDays = useMemo(() => findCashGapDays(dailySnapshots), [dailySnapshots])

  const taxSummary = useMemo(
    () => getTaxSummary(incomes, settings),
    [incomes, settings, rateDate],
  )

  const hasData =
    incomes.length > 0 ||
    expenses.length > 0 ||
    oneTimeExpenses.length > 0 ||
    (settings.initialBalance ?? 0) > 0

  if (!hasData) {
    return (
      <EmptyState
        title="Добро пожаловать!"
        description="Начните с настроек страны и налогового режима, затем добавьте доходы и расходы."
      />
    )
  }

  const annualTaxes =
    (taxSummary?.result.incomeTax ?? 0) + (taxSummary?.result.socialContributions ?? 0)
  const initialBalance = getInitialBalanceInBase(settings)

  return (
    <div className="space-y-4">
      <SummaryCards
        snapshots={snapshots}
        dailySnapshots={dailySnapshots}
        currency={settings.baseCurrency}
        annualTaxes={annualTaxes}
        initialBalance={initialBalance}
      />
      <CashFlowChart snapshots={dailySnapshots} currency={settings.baseCurrency} />
      {cashGapDays.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          <p className="font-medium">Кассовый разрыв: {cashGapDays.length} дн.</p>
          <p className="mt-1 text-red-700">
            Первый разрыв — {formatDateDisplay(cashGapDays[0].date)}, минимальный баланс{' '}
            {formatCurrency(
              Math.min(...cashGapDays.map((d) => d.cumulativeBalance)),
              settings.baseCurrency,
            )}
          </p>
        </div>
      )}
      {taxSummary && (
        <TaxBreakdown
          regimeName={taxSummary.calculator.name}
          effectiveRate={taxSummary.result.effectiveRate}
          breakdown={taxSummary.result.breakdown}
          currency={settings.baseCurrency}
        />
      )}
      <MonthlyTable snapshots={snapshots} currency={settings.baseCurrency} />
    </div>
  )
}
