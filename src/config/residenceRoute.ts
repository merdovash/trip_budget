import type { BudgetSettings, ResidenceRoutePoint } from '../types/budget'
import { getAvailableCountries, getCalculatorsByCountry, COUNTRY_LABELS } from '../tax/registry'
import { formatDateDisplay, isValidIsoDate, todayIsoDate } from '../lib/format'

const OPEN_END = '9999-12-31'
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function legacyRelocationDate(settings: BudgetSettings): string {
  return settings.relocationDate ?? settings.initialBalanceDate
}

export function isOpenEndedRouteDate(iso: string | undefined | null): boolean {
  return !iso || iso === OPEN_END
}

/** Сдвиг ISO-даты (YYYY-MM-DD) на N календарных дней. */
export function shiftIsoDate(iso: string, days: number): string {
  const match = ISO_DATE_RE.exec(iso)
  if (!match) {
    throw new RangeError(`Invalid ISO date: ${iso}`)
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid ISO date: ${iso}`)
  }
  date.setUTCDate(date.getUTCDate() + days)
  // Не используем toISOString(): год вне 0–9999 даёт RangeError.
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${String(y).padStart(4, '0')}-${m}-${d}`
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

function formatRoutePeriod(point: Pick<ResidenceRoutePoint, 'startDate' | 'endDate'>): string {
  const start = formatDateDisplay(point.startDate)
  const end = isOpenEndedRouteDate(point.endDate) ? 'бессрочно' : formatDateDisplay(point.endDate)
  return `${start}–${end}`
}

/** Краткое описание точки маршрута для сообщений об ошибках. */
export function describeResidenceRoutePoint(
  point: Pick<ResidenceRoutePoint, 'countryCode' | 'startDate' | 'endDate'>,
): string {
  const country = COUNTRY_LABELS[point.countryCode] ?? point.countryCode
  return `${country} (${formatRoutePeriod(point)})`
}

export function findOverlappingRoutePoints(
  point: Pick<ResidenceRoutePoint, 'id' | 'startDate' | 'endDate'>,
  route: ResidenceRoutePoint[],
): ResidenceRoutePoint[] {
  return route.filter((other) => other.id !== point.id && rangesOverlap(point, other))
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
  const overlaps = findOverlappingRoutePoints(point, route)
  if (overlaps.length === 0) return null
  const details = overlaps.map(describeResidenceRoutePoint).join('; ')
  return overlaps.length === 1
    ? `Период пересекается с точкой маршрута: ${details}`
    : `Период пересекается с точками маршрута: ${details}`
}

export function validateResidenceRoute(route: ResidenceRoutePoint[]): string | null {
  for (const point of route) {
    if (point.endDate < point.startDate) {
      return 'Дата окончания не может быть раньше даты начала'
    }
  }
  const messages: string[] = []
  for (const point of route) {
    const overlaps = findOverlappingRoutePoints(point, route)
    if (overlaps.length === 0) continue
    // Сообщение только для «левой» точки пары, чтобы не дублировать A↔B.
    const laterOverlaps = overlaps.filter((other) => {
      const byStart = point.startDate.localeCompare(other.startDate)
      if (byStart !== 0) return byStart < 0
      return point.id.localeCompare(other.id) < 0
    })
    if (laterOverlaps.length === 0) continue
    const details = laterOverlaps.map(describeResidenceRoutePoint).join('; ')
    messages.push(
      `${describeResidenceRoutePoint(point)} пересекается с: ${details}`,
    )
  }
  if (messages.length === 0) return null
  return messages.join('. ')
}

function normalizeRoutePoint(point: ResidenceRoutePoint): ResidenceRoutePoint {
  return {
    ...point,
    endDate: isOpenEndedRouteDate(point.endDate) ? OPEN_END : point.endDate,
  }
}

/** Эффективный маршрут: явный residenceRoute или одна точка из legacy-настроек (по датам). */
export function getResidenceRoute(settings: BudgetSettings): ResidenceRoutePoint[] {
  if (settings.residenceRoute && settings.residenceRoute.length > 0) {
    return sortResidenceRoute(settings.residenceRoute.map(normalizeRoutePoint))
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
    return sortResidenceRoute(settings.residenceRoute!.map(normalizeRoutePoint))
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
    relocationDate: first?.startDate ?? todayIsoDate(),
  }
}

export function createResidenceRoutePoint(
  partial?: Partial<ResidenceRoutePoint>,
): ResidenceRoutePoint {
  const countryCode = partial?.countryCode ?? getAvailableCountries()[0] ?? 'ES'
  const regime = getCalculatorsByCountry(countryCode)[0]
  const today = todayIsoDate()
  const startDate =
    partial?.startDate && isValidIsoDate(partial.startDate) ? partial.startDate : today
  const rawEnd = partial?.endDate
  const endDate = isOpenEndedRouteDate(rawEnd)
    ? OPEN_END
    : isValidIsoDate(rawEnd!)
      ? rawEnd!
      : startDate
  return {
    id: partial?.id ?? `route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    countryCode,
    taxRegimeId: partial?.taxRegimeId ?? regime?.id ?? 'es-employed',
    startDate,
    endDate,
    ...(partial?.regimeParams ? { regimeParams: partial.regimeParams } : {}),
  }
}

export function describeResidenceRoute(settings: BudgetSettings): string {
  const route = getResidenceRoute(settings)
  return route
    .map((p) => {
      const end = isOpenEndedRouteDate(p.endDate) ? '…' : p.endDate
      return `${p.countryCode}: ${p.startDate}–${end}`
    })
    .join(' → ')
}
