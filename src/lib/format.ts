export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

export const DATE_RU_PLACEHOLDER = 'ДД.ММ.ГГГГ'

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const RU_DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/

function isValidDateParts(day: number, month: number, year: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1000 || year > 9999) {
    return false
  }
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  )
}

export function isValidIsoDate(iso: string): boolean {
  const match = iso.match(ISO_DATE_RE)
  if (!match) return false
  return isValidDateParts(Number(match[3]), Number(match[2]), Number(match[1]))
}

export function formatIsoToRu(iso: string): string {
  if (!iso) return ''
  const match = iso.match(ISO_DATE_RE)
  if (!match) return iso
  return `${match[3]}.${match[2]}.${match[1]}`
}

export function parseRuToIso(ru: string): string | null {
  const trimmed = ru.trim()
  if (!trimmed) return ''
  const match = trimmed.match(RU_DATE_RE)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (!isValidDateParts(day, month, year)) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function maskRuDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}

export function formatDateDisplay(value: string): string {
  if (!value) return '—'
  if (ISO_DATE_RE.test(value)) return formatIsoToRu(value)
  return value
}

/** ISO datetime (или дата) → «15.01.2026, 14:30». */
export function formatDateTimeDisplay(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    if (ISO_DATE_RE.test(value)) return formatIsoToRu(value)
    return value
  }
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatShortDate(iso: string): string {
  if (!ISO_DATE_RE.test(iso)) return iso
  const [, month, day] = iso.match(ISO_DATE_RE) ?? []
  return `${day}.${month}`
}

export function todayIsoDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDayOfMonth(day: number): string {
  return `${day}-е число`
}
