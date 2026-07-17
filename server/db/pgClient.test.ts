import { describe, expect, it } from 'vitest'
import { formatSql } from './pgClient'

describe('formatSql', () => {
  it('binds scalars and jsonb', () => {
    const sql = formatSql('SELECT $1, $2, $3', ['a', 2, { x: 1 }])
    expect(sql).toContain("'a'")
    expect(sql).toContain('2')
    expect(sql).toContain('::jsonb')
  })

  it('binds null', () => {
    expect(formatSql('SELECT $1', [null])).toBe('SELECT NULL')
  })
})
