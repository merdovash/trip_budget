import { describe, expect, it } from 'vitest'
import {
  isAppSectionPath,
  normalizePath,
  pathToSection,
  sectionToPath,
} from './appRoutes'

describe('appRoutes', () => {
  it('maps sections to paths and back', () => {
    expect(sectionToPath('dashboard')).toBe('/')
    expect(sectionToPath('expenses')).toBe('/expenses')
    expect(pathToSection('/')).toBe('dashboard')
    expect(pathToSection('/expenses')).toBe('expenses')
    expect(pathToSection('/expenses/')).toBe('expenses')
  })

  it('falls back unknown paths to dashboard', () => {
    expect(pathToSection('/unknown')).toBe('dashboard')
    expect(isAppSectionPath('/unknown')).toBe(false)
    expect(isAppSectionPath('/settings')).toBe(true)
  })

  it('normalizes trailing slashes', () => {
    expect(normalizePath('/route/')).toBe('/route')
    expect(normalizePath('/')).toBe('/')
  })
})
