import { describe, expect, it } from 'vitest'
import {
  formatCompactAxisValue,
  formatDateDisplay,
  formatDateTimeDisplay,
  formatIsoToRu,
  isValidIsoDate,
  maskRuDateInput,
  parseRuToIso,
} from './format'

describe('date format', () => {
  it('converts ISO to RU format', () => {
    expect(formatIsoToRu('2026-07-11')).toBe('11.07.2026')
  })

  it('parses RU format to ISO', () => {
    expect(parseRuToIso('11.07.2026')).toBe('2026-07-11')
  })

  it('rejects invalid calendar dates', () => {
    expect(parseRuToIso('31.02.2026')).toBeNull()
    expect(isValidIsoDate('2026-02-31')).toBe(false)
  })

  it('masks digits while typing', () => {
    expect(maskRuDateInput('11072026')).toBe('11.07.2026')
  })

  it('formats stored ISO for display', () => {
    expect(formatDateDisplay('2026-01-15')).toBe('15.01.2026')
    expect(formatDateDisplay('')).toBe('—')
  })

  it('formats datetime with time', () => {
    const formatted = formatDateTimeDisplay('2026-01-15T14:30:00.000Z')
    expect(formatted).toMatch(/15\.01\.2026/)
    expect(formatted).toMatch(/\d{2}:\d{2}/)
    expect(formatDateTimeDisplay('')).toBe('—')
  })
})

describe('formatCompactAxisValue', () => {
  it('formats millions as М', () => {
    expect(formatCompactAxisValue(8_000_000)).toBe('8М')
    expect(formatCompactAxisValue(1_500_000)).toBe('1,5М')
    expect(formatCompactAxisValue(-2_000_000)).toBe('−2М')
  })

  it('formats thousands as тыс', () => {
    expect(formatCompactAxisValue(12_500)).toBe('12,5тыс')
    expect(formatCompactAxisValue(8_000)).toBe('8тыс')
  })

  it('keeps small values as numbers', () => {
    expect(formatCompactAxisValue(800)).toBe('800')
    expect(formatCompactAxisValue(0)).toBe('0')
  })
})
