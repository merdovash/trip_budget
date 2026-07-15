import { useMemo, useState } from 'react'
import {
  calculateBudgetProjection,
  calculateDailyBudgetProjection,
  findCashGapDays,
  getDayLedger,
  getInitialBalanceInBase,
  getTaxSummary,
  shiftIsoDate,
} from '../../engine/budgetEngine'
import { formatCurrency, formatDateDisplay } from '../../lib/format'
import { useBudgetStore } from '../../store/budgetStore'
import { useExchangeRateStore } from '../../store/exchangeRateStore'
import { shouldShowSourceCountryTaxes } from '../../config/relocationMode'
import { EmptyState } from '../ui/FormControls'
import { CashFlowChart } from './CashFlowChart'
import { CollapsibleSection } from './CollapsibleSection'
import { DayDetailPanel } from './DayDetailPanel'
import { TaxesOverviewPanel } from './TaxesOverviewPanel'
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

  const taxSummary = useMemo(
    () => getTaxSummary(incomes, settings, expenses, oneTimeExpenses),
    [incomes, expenses, oneTimeExpenses, settings, rateDate],
  )

  const dayIndexByDate = useMemo(() => {
    const map = new Map<string, number>()
    dailySnapshots.forEach((s, i) => map.set(s.date, i))
    return map
  }, [dailySnapshots])

  const dayLedger = useMemo(() => {
    if (!selectedDay) return null
    return getDayLedger(incomes, expenses, oneTimeExpenses, selectedDay, settings)
  }, [selectedDay, incomes, expenses, oneTimeExpenses, settings, rateDate])

  const selectedIndex = selectedDay != null ? (dayIndexByDate.get(selectedDay) ?? -1) : -1
  const canPrev = selectedIndex > 0
  const canNext = selectedIndex >= 0 && selectedIndex < dailySnapshots.length - 1

  const hasData =
    incomes.length > 0 ||
    expenses.length > 0 ||
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
    (shouldShowSourceCountryTaxes(settings) ? taxSummary.russiaNdflInBase : 0)
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
      <CashFlowChart
        snapshots={dailySnapshots}
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
      {(incomes.length > 0 || taxSummary.residence) && (
        <CollapsibleSection title="Налоги">
          <TaxesOverviewPanel
            taxSummary={taxSummary}
            settings={settings}
            hasIncomes={incomes.length > 0}
          />
        </CollapsibleSection>
      )}
      <CollapsibleSection title="Помесячная таблица">
        <MonthlyTable snapshots={snapshots} currency={settings.baseCurrency} embedded />
      </CollapsibleSection>
    </div>
  )
}
