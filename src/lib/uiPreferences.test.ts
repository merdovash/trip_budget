import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readUiFlag, readUiRecord, writeUiFlag, writeUiRecord } from './uiPreferences'

function mockLocalStorage() {
  const store = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    clear: () => store.clear(),
    get store() {
      return store
    },
  }
  vi.stubGlobal('localStorage', localStorage)
  return localStorage
}

describe('uiPreferences', () => {
  let ls: ReturnType<typeof mockLocalStorage>

  beforeEach(() => {
    ls = mockLocalStorage()
  })

  it('persists boolean flags in localStorage', () => {
    expect(readUiFlag('section-taxes', false)).toBe(false)
    writeUiFlag('section-taxes', true)
    expect(ls.getItem('ui-pref:section-taxes')).toBe('1')
    expect(readUiFlag('section-taxes', false)).toBe(true)
  })

  it('persists record maps in localStorage', () => {
    writeUiRecord('expense-folders', { a: true, __none: false })
    expect(ls.getItem('ui-pref:expense-folders')).toBe(
      JSON.stringify({ a: true, __none: false }),
    )
    expect(readUiRecord('expense-folders')).toEqual({ a: true, __none: false })
  })

  it('falls back to defaults for invalid JSON', () => {
    ls.setItem('ui-pref:bad', 'not-json')
    expect(readUiRecord('bad', { x: true })).toEqual({ x: true })
  })
})
