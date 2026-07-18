import { describe, expect, it } from 'vitest'
import { formatSql, toMysqlParams } from './mysqlClient'

describe('formatSql', () => {
  it('binds scalars and json', () => {
    const sql = formatSql('SELECT $1, $2, $3', ['a', 2, { x: 1 }])
    expect(sql).toContain("'a'")
    expect(sql).toContain('2')
    expect(sql).toContain('CAST(')
    expect(sql).toContain('AS JSON')
  })

  it('binds null and boolean', () => {
    expect(formatSql('SELECT $1', [null])).toBe('SELECT NULL')
    expect(formatSql('SELECT $1', [true])).toBe('SELECT TRUE')
  })
})

describe('toMysqlParams', () => {
  it('converts $n placeholders to ?', () => {
    const { sql, params } = toMysqlParams('SELECT $1, $2', ['a', 2])
    expect(sql).toBe('SELECT ?, ?')
    expect(params).toEqual(['a', 2])
  })

  it('stringifies objects for JSON columns', () => {
    const { params } = toMysqlParams('INSERT INTO t (j) VALUES ($1)', [{ a: 1 }])
    expect(params[0]).toBe('{"a":1}')
  })
})
