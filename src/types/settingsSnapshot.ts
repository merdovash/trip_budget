import type { BudgetSettings } from './budget'

export interface SettingsSnapshot {
  id: string
  name: string
  savedAt: string
  settings: BudgetSettings
}

export interface SettingsSnapshotSummary {
  id: string
  name: string
  savedAt: string
  countryCode: string
  taxRegimeId: string
  baseCurrency: string
}
