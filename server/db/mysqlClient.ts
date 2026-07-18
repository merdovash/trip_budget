import mysql from 'mysql2/promise'
import type { Pool as MysqlPool, PoolConnection, ResultSetHeader } from 'mysql2/promise'

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[]
  rowCount: number
}

export type SqlQuery = <T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
) => Promise<QueryResult<T>>

interface ParsedUrl {
  host: string
  port: number
  user: string
  password: string
  database: string
}

function parseDatabaseUrl(url: string): ParsedUrl {
  const parsed = new URL(url)
  return {
    host: parsed.hostname || 'localhost',
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username || 'root'),
    password: decodeURIComponent(parsed.password || ''),
    database: decodeURIComponent((parsed.pathname || '/finance').replace(/^\//, '') || 'finance'),
  }
}

function escapeLiteral(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
}

/** Bind `$1..$n` placeholders with SQL literals (MySQL dialect). Exported for unit tests. */
export function formatSql(sql: string, params: unknown[]): string {
  return sql.replace(/\$(\d+)/g, (_, n: string) => {
    const param = params[Number(n) - 1]
    if (param === null || param === undefined) return 'NULL'
    if (typeof param === 'number') {
      if (!Number.isFinite(param)) throw new Error('Invalid number parameter')
      return String(param)
    }
    if (typeof param === 'boolean') return param ? 'TRUE' : 'FALSE'
    if (param instanceof Date) {
      return escapeLiteral(param.toISOString().slice(0, 23).replace('T', ' '))
    }
    if (typeof param === 'object') {
      return `CAST(${escapeLiteral(JSON.stringify(param))} AS JSON)`
    }
    return escapeLiteral(String(param))
  })
}

/** Convert `$1..$n` to `?` and build ordered params for mysql2. */
export function toMysqlParams(sql: string, params: unknown[]): { sql: string; params: unknown[] } {
  const ordered: unknown[] = []
  const converted = sql.replace(/\$(\d+)/g, (_, n: string) => {
    const param = params[Number(n) - 1]
    if (param !== null && typeof param === 'object' && !(param instanceof Date)) {
      ordered.push(JSON.stringify(param))
    } else if (typeof param === 'boolean') {
      ordered.push(param ? 1 : 0)
    } else {
      ordered.push(param ?? null)
    }
    return '?'
  })
  return { sql: converted, params: ordered }
}

async function runQuery<T>(
  conn: PoolConnection | MysqlPool,
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  const prepared = toMysqlParams(sql, params)
  const [result] = await conn.query(prepared.sql, prepared.params)

  if (Array.isArray(result)) {
    return {
      rows: result as T[],
      rowCount: result.length,
    }
  }

  const header = result as ResultSetHeader
  return {
    rows: [] as T[],
    rowCount: header.affectedRows ?? 0,
  }
}

export function newId(): string {
  return crypto.randomUUID()
}

/** MySQL pool wrapping mysql2; keeps `$1..$n` placeholder API. */
export class Pool {
  private pool: MysqlPool

  constructor(connectionString?: string) {
    const url = connectionString ?? process.env.DATABASE_URL ?? ''
    if (!url) {
      throw new Error('DATABASE_URL is not set')
    }
    const auth = parseDatabaseUrl(url)
    this.pool = mysql.createPool({
      host: auth.host,
      port: auth.port,
      user: auth.user,
      password: auth.password,
      database: auth.database,
      waitForConnections: true,
      connectionLimit: 10,
      dateStrings: true,
      multipleStatements: true,
      enableKeepAlive: true,
    })
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return runQuery<T>(this.pool, sql, params)
  }

  /** Run raw multi-statement SQL (migrations). */
  async exec(sql: string): Promise<void> {
    await this.pool.query(sql)
  }

  async withConnection<T>(fn: (query: SqlQuery) => Promise<T>): Promise<T> {
    const conn = await this.pool.getConnection()
    const query: SqlQuery = async <R = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ) => runQuery<R>(conn, sql, params)
    try {
      return await fn(query)
    } finally {
      conn.release()
    }
  }

  async transaction<T>(fn: (query: SqlQuery) => Promise<T>): Promise<T> {
    return this.withConnection(async (query) => {
      await query('START TRANSACTION')
      try {
        const result = await fn(query)
        await query('COMMIT')
        return result
      } catch (err) {
        try {
          await query('ROLLBACK')
        } catch {
          /* ignore */
        }
        throw err
      }
    })
  }

  async end(): Promise<void> {
    await this.pool.end()
  }
}
