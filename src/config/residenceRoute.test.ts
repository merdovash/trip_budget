import { describe, expect, it } from 'vitest'
import {
  getResidenceOnDate,
  getResidenceRoute,
  getRouteSegmentsInYear,
  hasExplicitResidenceRoute,
} from './residenceRoute'
import { isResidenceLifeStarted, getRelocationDate } from './relocationPrograms'
import { DEFAULT_SETTINGS } from '../types/budget'

describe('residenceRoute', () => {
  it('falls back to legacy country and relocation date', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      countryCode: 'GE',
      taxRegimeId: 'ge-standard',
      relocationDate: '2026-03-01',
      residenceRoute: undefined,
    }
    expect(hasExplicitResidenceRoute(settings)).toBe(false)
    const route = getResidenceRoute(settings)
    expect(route).toHaveLength(1)
    expect(route[0].countryCode).toBe('GE')
    expect(getRelocationDate(settings)).toBe('2026-03-01')
    expect(isResidenceLifeStarted('2026-02-28', settings)).toBe(false)
    expect(isResidenceLifeStarted('2026-03-01', settings)).toBe(true)
  })

  it('resolves country by date along the route', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      residenceRoute: [
        {
          id: 'a',
          countryCode: 'GE',
          taxRegimeId: 'ge-standard',
          startDate: '2026-01-01',
          endDate: '2026-06-30',
        },
        {
          id: 'b',
          countryCode: 'TH',
          taxRegimeId: 'th-standard',
          startDate: '2026-07-01',
          endDate: '2026-12-31',
        },
      ],
    }
    expect(getResidenceOnDate(settings, '2026-06-15')?.countryCode).toBe('GE')
    expect(getResidenceOnDate(settings, '2026-07-01')?.countryCode).toBe('TH')
    expect(getResidenceOnDate(settings, '2025-12-31')).toBeNull()
    expect(getRouteSegmentsInYear(settings, 2026)).toHaveLength(2)
    expect(isResidenceLifeStarted('2026-08-01', settings)).toBe(true)
  })
})
