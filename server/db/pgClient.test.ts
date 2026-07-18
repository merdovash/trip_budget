import { describe, expect, it } from 'vitest'
import { formatSql, md5PasswordResponse } from './pgClient'

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

describe('md5PasswordResponse', () => {
  it('matches Postgres MD5 password formula', () => {
    const salt = Buffer.from(Uint8Array.from([1, 2, 3, 4]))
    const result = md5PasswordResponse('user', 'secret', salt)
    expect(result.startsWith('md5')).toBe(true)
    expect(result).toHaveLength(3 + 32)
    expect(result).toBe(md5PasswordResponse('user', 'secret', salt))
  })
})
