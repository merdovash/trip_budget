import type { BudgetSettings, ResidenceRoutePoint } from '../types/budget'
import { getAvailableCountries, getCalculatorsByCountry } from '../tax/registry'

function legacyRelocationDate(settings: BudgetSettings): string {
  return settings.relocationDate ?? settings.initialBalanceDate
}

/** Эффективный маршрут: явный residenceRoute или одна точка из legacy-настроек. */
export function getResidenceRoute(settings: BudgetSettings): ResidenceRoutePoint[] {
  if (settings.residenceRoute && settings.residenceRoute.length > 0) {
    return settings.residenceRoute
  }
  return [
    {
      id: 'legacy',
      countryCode: settings.countryCode,
      taxRegimeId: settings.taxRegimeId,
      startDate: legacyRelocationDate(settings),
      endDate: '9999-12-31',
    },
  ]
}

export function hasExplicitResidenceRoute(settings: BudgetSettings): boolean {
  return Boolean(settings.residenceRoute && settings.residenceRoute.length > 0)
}

/** Гарантирует явный маршрут (миграция с legacy countryCode + taxRegimeId). */
export function ensureExplicitResidenceRoute(settings: BudgetSettings): ResidenceRoutePoint[] {
  if (hasExplicitResidenceRoute(settings)) {
    return settings.residenceRoute!
  }
  return [
    createResidenceRoutePoint({
      countryCode: settings.countryCode,
      taxRegimeId: settings.taxRegimeId,
      startDate: legacyRelocationDate(settings),
      endDate: '9999-12-31',
    }),
  ]
}

export function routeIncludesCountry(settings: BudgetSettings, countryCode: string): boolean {
  return getResidenceRoute(settings).some((point) => point.countryCode === countryCode)
}

export function getPrimaryResidenceCountry(settings: BudgetSettings): string {
  return getResidenceRoute(settings)[0]?.countryCode ?? settings.countryCode
}

/** Дата начала жизни за рубежом = старт первой точки маршрута. */
export function getRouteStartDate(settings: BudgetSettings): string {
  const route = getResidenceRoute(settings)
  return route.reduce(
    (earliest, point) => (point.startDate < earliest ? point.startDate : earliest),
    route[0].startDate,
  )
}

export function getResidenceOnDate(
  settings: BudgetSettings,
  dateStr: string,
): ResidenceRoutePoint | null {
  for (const point of getResidenceRoute(settings)) {
    if (dateStr >= point.startDate && dateStr <= point.endDate) {
      return point
    }
  }
  return null
}

export function getRouteSegmentsInYear(
  settings: BudgetSettings,
  year: number,
): ResidenceRoutePoint[] {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  return getResidenceRoute(settings).filter(
    (point) => point.startDate <= yearEnd && point.endDate >= yearStart,
  )
}

/** Настройки для расчёта налогов сегмента (страна + режим + параметры точки). */
export function settingsForResidencePoint(
  settings: BudgetSettings,
  point: ResidenceRoutePoint,
): BudgetSettings {
  const countryDeductions = { ...settings.countryDeductions }
  if (point.countryCode === 'TH') {
    countryDeductions.TH = point.regimeParams ?? settings.countryDeductions?.TH
  }
  return {
    ...settings,
    countryCode: point.countryCode,
    taxRegimeId: point.taxRegimeId,
    relocationDate: point.startDate,
    countryDeductions,
  }
}

export function syncLegacyFromRoute(
  route: ResidenceRoutePoint[],
): Pick<BudgetSettings, 'countryCode' | 'taxRegimeId' | 'relocationDate' | 'residenceRoute'> {
  const first = [...route].sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
  return {
    residenceRoute: route,
    countryCode: first.countryCode,
    taxRegimeId: first.taxRegimeId,
    relocationDate: first.startDate,
  }
}

export function createResidenceRoutePoint(
  partial?: Partial<ResidenceRoutePoint>,
): ResidenceRoutePoint {
  const countryCode = partial?.countryCode ?? getAvailableCountries()[0] ?? 'ES'
  const regime = getCalculatorsByCountry(countryCode)[0]
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: partial?.id ?? `route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    countryCode,
    taxRegimeId: partial?.taxRegimeId ?? regime?.id ?? 'es-employed',
    startDate: partial?.startDate ?? today,
    endDate: partial?.endDate ?? today,
  }
}

export function describeResidenceRoute(settings: BudgetSettings): string {
  const route = getResidenceRoute(settings)
  return route
    .map((p) => {
      const end = p.endDate === '9999-12-31' ? '…' : p.endDate
      return `${p.countryCode}: ${p.startDate}–${end}`
    })
    .join(' → ')
}
