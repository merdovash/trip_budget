import type { BudgetSettings, OneTimeExpense, RecurringItem } from '../types/budget'
import type { RelocationMode } from '../types/budget'

export type ItemLifecycle = 'destination' | 'origin' | 'any'

export function getRelocationDate(settings: BudgetSettings): string {
  return settings.relocationDate ?? settings.initialBalanceDate
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function getEffectiveStartDate(item: RecurringItem, settings: BudgetSettings): string {
  const relocation = getRelocationDate(settings)
  const lifecycle = item.lifecycle ?? 'any'
  if (lifecycle === 'destination') {
    return item.startDate > relocation ? item.startDate : relocation
  }
  return item.startDate
}

export function getEffectiveEndDate(
  item: RecurringItem,
  settings: BudgetSettings,
): string | undefined {
  const lifecycle = item.lifecycle ?? 'any'
  if (lifecycle === 'origin') {
    const lastOriginDay = addDays(getRelocationDate(settings), -1)
    if (!item.endDate) return lastOriginDay
    return item.endDate < lastOriginDay ? item.endDate : lastOriginDay
  }
  return item.endDate
}

export function isResidenceLifeStarted(dateStr: string, settings: BudgetSettings): boolean {
  return dateStr >= getRelocationDate(settings)
}

export function isItemActiveOnDay(
  item: RecurringItem,
  dateStr: string,
  settings: BudgetSettings,
): boolean {
  const startDate = getEffectiveStartDate(item, settings)
  const endDate = getEffectiveEndDate(item, settings)
  if (dateStr < startDate) return false
  if (endDate && dateStr > endDate) return false
  if (item.frequency === 'once') return dateStr === startDate
  return true
}

export function isItemActiveInMonth(
  item: RecurringItem,
  monthKey: string,
  settings: BudgetSettings,
): boolean {
  const startDate = getEffectiveStartDate(item, settings)
  const endDate = getEffectiveEndDate(item, settings)
  const monthStart = `${monthKey}-01`
  const monthEnd = monthKey

  if (startDate.slice(0, 7) > monthEnd) return false
  if (endDate && endDate.slice(0, 7) < monthEnd) return false

  if (item.frequency === 'once') {
    return startDate.slice(0, 7) === monthEnd
  }

  return startDate <= monthStart || startDate.slice(0, 7) <= monthEnd
}

export interface RelocationExpenseTemplate {
  name: string
  amount: number
  currency: string
  category: string
  /** Смещение в днях от даты переезда (отрицательное — до переезда). */
  offsetDays: number
}

export interface RelocationProgram {
  id: string
  countryCode: string
  name: string
  description: string
  /** Если задано — программа только для этих способов переезда. */
  modes?: RelocationMode[]
  expenses: RelocationExpenseTemplate[]
}

export const RELOCATION_PROGRAM_NONE = 'none'

export const RELOCATION_PROGRAMS: RelocationProgram[] = [
  {
    id: 'ge-remote-relocation',
    countryCode: 'GE',
    modes: ['remote_employment'],
    name: 'Переезд в Грузию (удалёнка)',
    description:
      'Типовые разовые расходы: перелёт, регистрация, депозит аренды. Суммы ориентировочные.',
    expenses: [
      { name: 'Авиабилеты (семья)', amount: 1_200, currency: 'EUR', category: 'Переезд', offsetDays: -5 },
      { name: 'Регистрация / юр. помощь', amount: 500, currency: 'GEL', category: 'Переезд', offsetDays: 0 },
      { name: 'Депозит аренды', amount: 1_500, currency: 'GEL', category: 'Депозит', offsetDays: 0 },
      { name: 'Первый месяц аренды', amount: 1_500, currency: 'GEL', category: 'Депозит', offsetDays: 0 },
    ],
  },
  {
    id: 'ge-sole-prop-setup',
    countryCode: 'GE',
    modes: ['sole_proprietorship'],
    name: 'ИП в Грузии (малый бизнес)',
    description: 'Регистрация ИП, открытие счёта, первичные расходы на старт.',
    expenses: [
      { name: 'Регистрация ИП', amount: 200, currency: 'GEL', category: 'Переезд', offsetDays: -7 },
      { name: 'Юр. сопровождение', amount: 800, currency: 'GEL', category: 'Переезд', offsetDays: -3 },
      { name: 'Авиабилеты (семья)', amount: 1_200, currency: 'EUR', category: 'Переезд', offsetDays: -5 },
      { name: 'Депозит аренды', amount: 1_500, currency: 'GEL', category: 'Депозит', offsetDays: 0 },
    ],
  },
  {
    id: 'es-employed-relocation',
    countryCode: 'ES',
    modes: ['remote_employment'],
    name: 'Переезд в Испанию (найм)',
    description: 'Перелёт, виза/ВНЖ, депозит и мебель для старта в Испании.',
    expenses: [
      { name: 'Авиабилеты (семья)', amount: 1_500, currency: 'EUR', category: 'Переезд', offsetDays: -7 },
      { name: 'Виза / ВНЖ / пошлины', amount: 800, currency: 'EUR', category: 'Переезд', offsetDays: -14 },
      { name: 'Депозит аренды', amount: 2_500, currency: 'EUR', category: 'Депозит', offsetDays: 0 },
      { name: 'Мебель и быт', amount: 1_500, currency: 'EUR', category: 'Мебель', offsetDays: 7 },
    ],
  },
  {
    id: 'es-freelance-setup',
    countryCode: 'ES',
    modes: ['sole_proprietorship'],
    name: 'ИП / autónomo в Испании',
    description: 'Регистрация autónomo, перелёт и депозит.',
    expenses: [
      { name: 'Регистрация autónomo', amount: 300, currency: 'EUR', category: 'Переезд', offsetDays: -7 },
      { name: 'Авиабилеты (семья)', amount: 1_500, currency: 'EUR', category: 'Переезд', offsetDays: -7 },
      { name: 'Депозит аренды', amount: 2_500, currency: 'EUR', category: 'Депозит', offsetDays: 0 },
    ],
  },
  {
    id: 'th-residence-relocation',
    countryCode: 'TH',
    modes: ['remote_employment'],
    name: 'Переезд в Таиланд',
    description: 'Перелёт, виза, депозит и первичное обустройство.',
    expenses: [
      { name: 'Авиабилеты (семья)', amount: 1_800, currency: 'EUR', category: 'Переезд', offsetDays: -5 },
      { name: 'Виза / продление', amount: 15_000, currency: 'THB', category: 'Переезд', offsetDays: 0 },
      { name: 'Депозит аренды', amount: 40_000, currency: 'THB', category: 'Депозит', offsetDays: 0 },
      { name: 'Мебель и быт', amount: 30_000, currency: 'THB', category: 'Мебель', offsetDays: 7 },
    ],
  },
  {
    id: 'generic-relocation',
    countryCode: '*',
    name: 'Базовый переезд',
    description: 'Универсальный набор: перелёт и депозит без привязки к стране.',
    expenses: [
      { name: 'Авиабилеты', amount: 1_000, currency: 'EUR', category: 'Переезд', offsetDays: -5 },
      { name: 'Депозит аренды', amount: 2_000, currency: 'EUR', category: 'Депозит', offsetDays: 0 },
    ],
  },
]

export function getRelocationProgramsForCountry(
  countryCode: string,
  mode?: RelocationMode,
): RelocationProgram[] {
  const relocationMode = mode ?? 'remote_employment'
  return RELOCATION_PROGRAMS.filter((program) => {
    const countryMatch = program.countryCode === countryCode || program.countryCode === '*'
    const modeMatch = !program.modes || program.modes.includes(relocationMode)
    return countryMatch && modeMatch
  })
}

export function getRelocationProgram(programId: string | undefined): RelocationProgram | undefined {
  if (!programId || programId === RELOCATION_PROGRAM_NONE) return undefined
  return RELOCATION_PROGRAMS.find((program) => program.id === programId)
}

export function buildProgramOneTimeExpenses(
  program: RelocationProgram,
  relocationDate: string,
): Omit<OneTimeExpense, 'id'>[] {
  return program.expenses.map((template) => ({
    name: template.name,
    amount: template.amount,
    currency: template.currency,
    category: template.category,
    date: addDays(relocationDate, template.offsetDays),
  }))
}
