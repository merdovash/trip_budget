import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../types/budget'
import {
  deleteSettingsSnapshot,
  getSettingsSnapshot,
  listSettingsSnapshots,
  saveSettingsSnapshot,
} from './settingsSnapshots'

function installLocalStorageMock() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  })
}

describe('settingsSnapshots', () => {
  beforeEach(() => {
    installLocalStorageMock()
    localStorage.clear()
  })

  it('saves and lists snapshots', () => {
    const saved = saveSettingsSnapshot('Spain employed', {
      ...DEFAULT_SETTINGS,
      taxRegimeId: 'es-employed',
    })
    const list = listSettingsSnapshots()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(saved.id)
    expect(list[0].taxRegimeId).toBe('es-employed')
  })

  it('loads and deletes snapshot', () => {
    const saved = saveSettingsSnapshot('Test', DEFAULT_SETTINGS)
    expect(getSettingsSnapshot(saved.id)?.settings.baseCurrency).toBe('EUR')
    deleteSettingsSnapshot(saved.id)
    expect(listSettingsSnapshots()).toHaveLength(0)
  })
})
