import { useEffect, useState } from 'react'

const PREFIX = 'ui-pref:'

export function readUiPref(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

export function writeUiPref(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value)
  } catch {
    /* private mode / quota */
  }
}

export function readUiFlag(key: string, defaultValue: boolean): boolean {
  const raw = readUiPref(key)
  if (raw === null) return defaultValue
  return raw === '1'
}

export function writeUiFlag(key: string, value: boolean): void {
  writeUiPref(key, value ? '1' : '0')
}

export function readUiRecord(
  key: string,
  defaultValue: Record<string, boolean> = {},
): Record<string, boolean> {
  const raw = readUiPref(key)
  if (raw === null) return defaultValue
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, boolean>
    }
  } catch {
    /* ignore */
  }
  return defaultValue
}

export function writeUiRecord(key: string, value: Record<string, boolean>): void {
  writeUiPref(key, JSON.stringify(value))
}

/** Boolean UI preference (e.g. section open). Stored in localStorage when key is set. */
export function usePersistedFlag(
  key: string | undefined,
  defaultValue: boolean,
): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [value, setValue] = useState(() =>
    key ? readUiFlag(key, defaultValue) : defaultValue,
  )

  useEffect(() => {
    if (!key) return
    writeUiFlag(key, value)
  }, [key, value])

  return [value, setValue]
}

/** Map of id → collapsed. Stored as JSON in localStorage. */
export function usePersistedRecord(
  key: string,
  defaultValue: Record<string, boolean> = {},
): [
  Record<string, boolean>,
  (
    next:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void,
] {
  const [value, setValue] = useState(() => readUiRecord(key, defaultValue))

  useEffect(() => {
    writeUiRecord(key, value)
  }, [key, value])

  return [value, setValue]
}
