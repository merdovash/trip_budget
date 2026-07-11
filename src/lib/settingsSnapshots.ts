import type { BudgetSettings } from '../types/budget'
import type { SettingsSnapshot, SettingsSnapshotSummary } from '../types/settingsSnapshot'

const STORAGE_KEY = 'family-budget-settings-snapshots'

function readAll(): SettingsSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SettingsSnapshot[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(snapshots: SettingsSnapshot[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots))
}

export function listSettingsSnapshots(): SettingsSnapshotSummary[] {
  return readAll()
    .map((snapshot) => ({
      id: snapshot.id,
      name: snapshot.name,
      savedAt: snapshot.savedAt,
      countryCode: snapshot.settings.countryCode,
      taxRegimeId: snapshot.settings.taxRegimeId,
      baseCurrency: snapshot.settings.baseCurrency,
    }))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export function getSettingsSnapshot(id: string): SettingsSnapshot | undefined {
  return readAll().find((snapshot) => snapshot.id === id)
}

export function saveSettingsSnapshot(name: string, settings: BudgetSettings): SettingsSnapshot {
  const snapshot: SettingsSnapshot = {
    id: crypto.randomUUID(),
    name: name.trim(),
    savedAt: new Date().toISOString(),
    settings: { ...settings },
  }
  writeAll([snapshot, ...readAll()])
  return snapshot
}

export function deleteSettingsSnapshot(id: string): void {
  writeAll(readAll().filter((snapshot) => snapshot.id !== id))
}
