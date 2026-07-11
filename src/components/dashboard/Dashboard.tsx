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
import { SpainTaxDetailPanel } from './SpainTaxDetailPanel'
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
    (taxSummary.residence?.result.incomeTax ?? 0) +
    (taxSummary.residence?.result.socialContributions ?? 0) +
    taxSummary.russiaNdflInBase
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
      {taxSummary.residence && taxSummary.residence.calculator.countryCode === 'ES' ? (
        <SpainTaxDetailPanel
          regimeName={taxSummary.residence.calculator.name}
          regimeDescription={taxSummary.residence.calculator.description}
          result={taxSummary.residence.result}
          currency={settings.baseCurrency}
          paymentSchedule={taxSummary.spainSchedule?.payments}
          quarterlyGross={taxSummary.spainSchedule?.quarterlyGross}
        />
      ) : taxSummary.residence ? (
        <TaxBreakdown
          title="Налоги страны проживания"
          regimeName={taxSummary.residence.calculator.name}
          effectiveRate={taxSummary.residence.result.effectiveRate}
          breakdown={taxSummary.residence.result.breakdown}
          currency={settings.baseCurrency}
        />
      ) : null}
      {taxSummary.russiaSalary && (
        <TaxBreakdown
          title="Зарплата в России"
          regimeName="НДФЛ и страховые взносы"
          effectiveRate={
            taxSummary.russiaSalary.grossAnnual > 0
              ? taxSummary.russiaSalary.ndfl / taxSummary.russiaSalary.grossAnnual
              : 0
          }
          breakdown={taxSummary.russiaSalary.breakdown}
          currency="RUB"
          footer={
            taxSummary.russiaEmployerSocialInBase > 0
              ? `Взносы работодателя ≈ ${formatCurrency(taxSummary.russiaEmployerSocialInBase, settings.baseCurrency)} (информ.)`
              : undefined
          }
        />
      )}
      <MonthlyTable snapshots={snapshots} currency={settings.baseCurrency} />
    </div>
  )
}
