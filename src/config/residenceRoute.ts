import type { BudgetSettings, ResidenceRoutePoint } from '../types/budget'
import { getAvailableCountries, getCalculatorsByCountry } from '../tax/registry'

const OPEN_END = '9999-12-31'

function legacyRelocationDate(settings: BudgetSettings): string {
  return settings.relocationDate ?? settings.initialBalanceDate
}

/** Сдвиг ISO-даты (YYYY-MM-DD) на N календарных дней. */
export function shiftIsoDate(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Порядок точек: по дате начала, затем по окончанию. */
export function sortResidenceRoute(route: ResidenceRoutePoint[]): ResidenceRoutePoint[] {
  return [...route].sort((a, b) => {
    const byStart = a.startDate.localeCompare(b.startDate)
    if (byStart !== 0) return byStart
    return a.endDate.localeCompare(b.endDate)
  })
}

function rangesOverlap(
  a: Pick<ResidenceRoutePoint, 'startDate' | 'endDate'>,
  b: Pick<ResidenceRoutePoint, 'startDate' | 'endDate'>,
): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate
}

/** Проверка одной точки относительно остальных (даты включительно, пересечения запрещены). */
export function validateResidenceRoutePoint(
  point: Pick<ResidenceRoutePoint, 'id' | 'startDate' | 'endDate'>,
  route: ResidenceRoutePoint[],
): string | null {
  if (!point.startDate) return 'Укажите дату начала'
  if (point.endDate < point.startDate) {
    return 'Дата окончания не может быть раньше даты начала'
  }
  for (const other of route) {
    if (other.id === point.id) continue
    if (rangesOverlap(point, other)) {
      return 'Период пересекается с другой точкой маршрута'
    }
  }
  return null
}

export function validateResidenceRoute(route: ResidenceRoutePoint[]): string | null {
  for (const point of route) {
    if (point.endDate < point.startDate) {
      return 'Дата окончания не может быть раньше даты начала'
    }
  }
  const sorted = sortResidenceRoute(route)
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!
    const curr = sorted[i]!
    if (rangesOverlap(prev, curr)) {
      return 'Периоды точек маршрута пересекаются'
    }
  }
  return null
}

/** Эффективный маршрут: явный residenceRoute или одна точка из legacy-настроек (по датам). */
export function getResidenceRoute(settings: BudgetSettings): ResidenceRoutePoint[] {
  if (settings.residenceRoute && settings.residenceRoute.length > 0) {
    return sortResidenceRoute(settings.residenceRoute)
  }
  return [
    {
      id: 'legacy',
      countryCode: settings.countryCode,
      taxRegimeId: settings.taxRegimeId,
      startDate: legacyRelocationDate(settings),
      endDate: OPEN_END,
    },
  ]
}

export function hasExplicitResidenceRoute(settings: BudgetSettings): boolean {
  return Boolean(settings.residenceRoute && settings.residenceRoute.length > 0)
}

/** Гарантирует явный маршрут (миграция с legacy countryCode + taxRegimeId). */
export function ensureExplicitResidenceRoute(settings: BudgetSettings): ResidenceRoutePoint[] {
  if (hasExplicitResidenceRoute(settings)) {
    return sortResidenceRoute(settings.residenceRoute!)
  }
  return [
    createResidenceRoutePoint({
      countryCode: settings.countryCode,
      taxRegimeId: settings.taxRegimeId,
      startDate: legacyRelocationDate(settings),
      endDate: OPEN_END,
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
  return route[0]?.startDate ?? legacyRelocationDate(settings)
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
  const sorted = sortResidenceRoute(route)
  const first = sorted[0]
  return {
    residenceRoute: sorted,
    countryCode: first?.countryCode ?? 'ES',
    taxRegimeId: first?.taxRegimeId ?? 'es-employed',
    relocationDate: first?.startDate ?? new Date().toISOString().slice(0, 10),
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
    ...(partial?.regimeParams ? { regimeParams: partial.regimeParams } : {}),
  }
}

export function describeResidenceRoute(settings: BudgetSettings): string {
  const route = getResidenceRoute(settings)
  return route
    .map((p) => {
      const end = p.endDate === OPEN_END ? '…' : p.endDate
      return `${p.countryCode}: ${p.startDate}–${end}`
    })
    .join(' → ')
}
