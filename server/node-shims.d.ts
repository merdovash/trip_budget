declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf-8'): string
  export function writeFileSync(path: string, data: string, encoding?: 'utf-8'): void
  export function existsSync(path: string): boolean
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void
  export function copyFileSync(src: string, dest: string): void
  export function unlinkSync(path: string): void
}

declare module 'node:path' {
  export function resolve(...paths: string[]): string
  export function join(...paths: string[]): string
}

declare module 'node:crypto' {
  export function randomUUID(): string
}

declare module 'node:os' {
  export function tmpdir(): string
}

declare module 'node:http' {
  export interface IncomingMessage {
    method?: string
    url?: string
    on(event: 'data', listener: (chunk: Uint8Array | string) => void): void
    on(event: 'end' | 'error', listener: () => void): void
    [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array | string>
  }
  export interface ServerResponse {
    statusCode: number
    setHeader(name: string, value: string): void
    end(chunk?: string): void
  }
}

declare const process: {
  cwd(): string
  env: Record<string, string | undefined>
}

interface BufferInstance extends Uint8Array {
  toString(encoding: 'utf-8'): string
}

interface BufferConstructor {
  concat(buffers: Uint8Array[]): BufferInstance
  from(data: string): BufferInstance
}

declare const Buffer: BufferConstructor

declare function structuredClone<T>(value: T): T

declare class URL {
  constructor(input: string, base?: string)
  pathname: string
  searchParams: URLSearchParams
}

declare class URLSearchParams {
  constructor(init?: string)
  get(name: string): string | null
}
