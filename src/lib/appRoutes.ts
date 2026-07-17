import type { AppSection } from '../types/budget'

export const APP_SECTION_PATHS: Record<AppSection, string> = {
  dashboard: '/',
  settings: '/settings',
  route: '/route',
  balances: '/balances',
  income: '/income',
  expenses: '/expenses',
  report: '/report',
  presets: '/presets',
}

const PATH_TO_SECTION = new Map(
  (Object.entries(APP_SECTION_PATHS) as [AppSection, string][]).map(([section, path]) => [
    path,
    section,
  ]),
)

export function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '') || '/'
}

export function pathToSection(pathname: string): AppSection {
  return PATH_TO_SECTION.get(normalizePath(pathname)) ?? 'dashboard'
}

export function sectionToPath(section: AppSection): string {
  return APP_SECTION_PATHS[section]
}

export function isAppSectionPath(pathname: string): boolean {
  return PATH_TO_SECTION.has(normalizePath(pathname))
}
