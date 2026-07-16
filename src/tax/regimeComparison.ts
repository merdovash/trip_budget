import { getResidenceRoute } from '../config/residenceRoute'
import { shouldShowSourceCountryTaxes } from '../config/relocationMode'
import {
  computeYearTaxForRoutePoint,
  getHorizonTaxYears,
  taxSummaryTotalInBase,
} from '../engine/budgetEngine'
import type { BudgetSettings, OneTimeExpense, RecurringItem, ResidenceRoutePoint } from '../types/budget'
import { COUNTRY_LABELS, getCalculatorsByCountry, getTaxCalculator } from './registry'

export interface RegimeYearTax {
  year: number
  totalInBase: number
}

export interface RegimeComparisonRow {
  regimeId: string
  regimeName: string
  isSelected: boolean
  isBest: boolean
  years: RegimeYearTax[]
  totalInBase: number
}

export interface RoutePointRegimeComparison {
  pointId: string
  pointIndex: number
  countryCode: string
  countryLabel: string
  dateRangeLabel: string
  selectedRegimeId: string
  bestRegimeId: string
  /** Экономия при переходе с текущего на лучший (> 0 — текущий дороже). */
  savingsVsSelectedInBase: number
  years: number[]
  rows: RegimeComparisonRow[]
}

function yearsOverlappingPoint(settings: BudgetSettings, point: ResidenceRoutePoint): number[] {
  const horizonYears = getHorizonTaxYears(settings)
  return horizonYears.filter((year) => {
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`
    return point.startDate <= yearEnd && point.endDate >= yearStart
  })
}

function formatDateRange(point: ResidenceRoutePoint): string {
  const end = point.endDate === '9999-12-31' ? '∞' : point.endDate
  return `${point.startDate} – ${end}`
}

export function compareRegimesForRoutePoint(
  point: ResidenceRoutePoint,
  pointIndex: number,
  settings: BudgetSettings,
  incomes: RecurringItem[],
  expenses: RecurringItem[] = [],
  oneTimeExpenses: OneTimeExpense[] = [],
): RoutePointRegimeComparison | null {
  const regimes = getCalculatorsByCountry(point.countryCode)
  if (regimes.length <= 1) return null

  const years = yearsOverlappingPoint(settings, point)
  if (years.length === 0) return null

  const includeSource = shouldShowSourceCountryTaxes(settings, incomes)

  const rows: RegimeComparisonRow[] = regimes.map((calc) => {
    const hypothetical: ResidenceRoutePoint = { ...point, taxRegimeId: calc.id }
    const yearTaxes = years.map((year) => {
      const summary = computeYearTaxForRoutePoint(
        hypothetical,
        year,
        settings,
        incomes,
        expenses,
        oneTimeExpenses,
      )
      return {
        year,
        totalInBase: taxSummaryTotalInBase(summary, settings, includeSource),
      }
    })
    const totalInBase = yearTaxes.reduce((sum, y) => sum + y.totalInBase, 0)
    return {
      regimeId: calc.id,
      regimeName: calc.name,
      isSelected: calc.id === point.taxRegimeId,
      isBest: false,
      years: yearTaxes,
      totalInBase,
    }
  })

  const bestTotal = Math.min(...rows.map((r) => r.totalInBase))
  const bestRow = rows.find((r) => r.totalInBase === bestTotal) ?? rows[0]
  const selectedRow =
    rows.find((r) => r.isSelected) ??
    rows.find((r) => r.regimeId === point.taxRegimeId) ??
    rows[0]

  const annotated = rows.map((row) => ({
    ...row,
    isBest: row.regimeId === bestRow.regimeId,
  }))

  return {
    pointId: point.id,
    pointIndex,
    countryCode: point.countryCode,
    countryLabel: COUNTRY_LABELS[point.countryCode] ?? point.countryCode,
    dateRangeLabel: formatDateRange(point),
    selectedRegimeId: selectedRow.regimeId,
    bestRegimeId: bestRow.regimeId,
    savingsVsSelectedInBase: selectedRow.totalInBase - bestRow.totalInBase,
    years,
    rows: annotated.sort((a, b) => a.totalInBase - b.totalInBase),
  }
}

export function compareRegimesForRoute(
  settings: BudgetSettings,
  incomes: RecurringItem[],
  expenses: RecurringItem[] = [],
  oneTimeExpenses: OneTimeExpense[] = [],
): RoutePointRegimeComparison[] {
  return getResidenceRoute(settings)
    .map((point, index) =>
      compareRegimesForRoutePoint(point, index, settings, incomes, expenses, oneTimeExpenses),
    )
    .filter((item): item is RoutePointRegimeComparison => item != null)
}

export function getRegimeDisplayName(regimeId: string): string {
  return getTaxCalculator(regimeId)?.name ?? regimeId
}
