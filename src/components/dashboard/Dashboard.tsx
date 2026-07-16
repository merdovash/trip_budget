import { useMemo, useState } from 'react'
import {
  calculateBudgetProjection,
  calculateDailyBudgetProjection,
  findCashGapDays,
  getDayLedger,
  getTaxSummariesByHorizon,
  shiftIsoDate,
  yearTaxTotalInBase,
} from '../../engine/budgetEngine'
import { getInitialBalanceInBase, hasInitialBalance } from '../../lib/initialBalance'
import { formatCurrency, formatDateDisplay } from '../../lib/format'
import { useBudgetStore } from '../../store/budgetStore'
import { useExchangeRateStore } from '../../store/exchangeRateStore'
import { shouldShowSourceCountryTaxes } from '../../config/relocationMode'
import { compareRegimesForRoute } from '../../tax/regimeComparison'
import { EmptyState } from '../ui/FormControls'
import { CashFlowChart } from './CashFlowChart'
import { CollapsibleSection } from './CollapsibleSection'
import { DayDetailPanel } from './DayDetailPanel'
import { TaxesOverviewPanel } from './TaxesOverviewPanel'
import { RegimeComparisonPanel } from './RegimeComparisonPanel'
import { MonthlyTable } from './MonthlyTable'
import { SummaryCards } from './SummaryCards'

export function Dashboard() {
  const settings = useBudgetStore((s) => s.settings)
  const incomes = useBudgetStore((s) => s.incomes)
  const expenses = useBudgetStore((s) => s.expenses)
  const oneTimeExpenses = useBudgetStore((s) => s.oneTimeExpenses)
  const rateDate = useExchangeRateStore((s) => s.rateDate)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const snapshots = useMemo(
    () => calculateBudgetProjection(incomes, expenses, oneTimeExpenses, settings),
    [incomes, expenses, oneTimeExpenses, settings, rateDate],
  )

  const dailySnapshots = useMemo(
    () => calculateDailyBudgetProjection(incomes, expenses, oneTimeExpenses, settings),
    [incomes, expenses, oneTimeExpenses, settings, rateDate],
  )

  const cashGapDays = useMemo(() => findCashGapDays(dailySnapshots), [dailySnapshots])

  const yearTaxSummaries = useMemo(
    () => getTaxSummariesByHorizon(incomes, settings, expenses, oneTimeExpenses),
    [incomes, expenses, oneTimeExpenses, settings, rateDate],
  )

  const regimeComparisons = useMemo(
    () => compareRegimesForRoute(settings, incomes, expenses, oneTimeExpenses),
    [settings, incomes, expenses, oneTimeExpenses, rateDate],
  )

  const dayIndexByDate = useMemo(() => {
    const map = new Map<string, number>()
    dailySnapshots.forEach((s, i) => map.set(s.date, i))
    return map
  }, [dailySnapshots])

  const dayLedger = useMemo(() => {
    if (!selectedDay) return null
    const idx = dayIndexByDate.get(selectedDay)
    const savingsInterestInBase =
      idx != null ? (dailySnapshots[idx]?.savingsInterest ?? 0) : 0
    return getDayLedger(incomes, expenses, oneTimeExpenses, selectedDay, settings, {
      savingsInterestInBase,
    })
  }, [selectedDay, dailySnapshots, dayIndexByDate, incomes, expenses, oneTimeExpenses, settings, rateDate])

  const selectedIndex = selectedDay != null ? (dayIndexByDate.get(selectedDay) ?? -1) : -1
  const canPrev = selectedIndex > 0
  const canNext = selectedIndex >= 0 && selectedIndex < dailySnapshots.length - 1

  const hasData =
    incomes.length > 0 ||
    expenses.length > 0 ||
    hasInitialBalance(settings)

  if (!hasData) {
    return (
      <EmptyState
        title="Добро пожаловать!"
        description="Начните с настроек страны и налогового режима, затем добавьте доходы и расходы."
      />
    )
  }

  const showSourceTaxes = shouldShowSourceCountryTaxes(settings, incomes)
  const annualTaxes =
    yearTaxSummaries.length > 0
      ? yearTaxSummaries.reduce(
          (sum, yearSummary) => sum + yearTaxTotalInBase(yearSummary, settings, showSourceTaxes),
          0,
        ) / yearTaxSummaries.length
      : 0
  const initialBalance = getInitialBalanceInBase(settings)
  const hasTaxContent =
    incomes.length > 0 || yearTaxSummaries.some((y) => y.parts.some((p) => p.summary.residence))

  return (
    <div className="space-y-4">
      <SummaryCards
        snapshots={snapshots}
        dailySnapshots={dailySnapshots}
        currency={settings.baseCurrency}
        annualTaxes={annualTaxes}
        initialBalance={initialBalance}
      />
      <CashFlowChart
        dailySnapshots={dailySnapshots}
        monthlySnapshots={snapshots}
        currency={settings.baseCurrency}
        onDayClick={setSelectedDay}
      />
      <DayDetailPanel
        open={selectedDay != null}
        ledger={dayLedger}
        currency={settings.baseCurrency}
        canPrev={canPrev}
        canNext={canNext}
        onPrev={() => {
          if (!selectedDay || !canPrev) return
          setSelectedDay(shiftIsoDate(selectedDay, -1))
        }}
        onNext={() => {
          if (!selectedDay || !canNext) return
          setSelectedDay(shiftIsoDate(selectedDay, 1))
        }}
        onClose={() => setSelectedDay(null)}
      />
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
      {hasTaxContent && (
        <CollapsibleSection title="Налоги">
          <TaxesOverviewPanel
            yearSummaries={yearTaxSummaries}
            settings={settings}
            hasIncomes={incomes.length > 0}
            incomes={incomes}
          />
        </CollapsibleSection>
      )}
      {regimeComparisons.length > 0 && (
        <CollapsibleSection title="Сравнение налоговых режимов">
          <RegimeComparisonPanel
            comparisons={regimeComparisons}
            baseCurrency={settings.baseCurrency}
          />
        </CollapsibleSection>
      )}
      <CollapsibleSection title="Помесячная таблица">
        <MonthlyTable snapshots={snapshots} currency={settings.baseCurrency} embedded />
      </CollapsibleSection>
    </div>
  )
}
