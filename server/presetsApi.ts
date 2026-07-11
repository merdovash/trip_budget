import type { IncomingMessage, ServerResponse } from 'node:http'
import type { CreatePresetInput } from '../src/types/preset'
import {
  createPreset,
  deletePreset,
  getPresetById,
  listOwnedPresets,
  listPublicPresets,
  updatePreset,
} from './presetsStore'

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  let raw = ''
  for await (const chunk of req) {
    raw += typeof chunk === 'string' ? chunk : Buffer.from(String(chunk)).toString('utf-8')
  }
  return JSON.parse(raw) as T
}

export async function handlePresetsApi(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  const method = req.method ?? 'GET'

  if (pathname === '/api/presets' && method === 'GET') {
    sendJson(res, 200, listPublicPresets())
    return true
  }

  if (pathname === '/api/presets/mine' && method === 'POST') {
    const body = await readJsonBody<{ refs?: Array<{ id: string; ownerToken: string }> }>(req)
    sendJson(res, 200, listOwnedPresets(body.refs ?? []))
    return true
  }

  if (pathname === '/api/presets' && method === 'POST') {
    const body = await readJsonBody<CreatePresetInput>(req)
    if (!body.name?.trim() || !body.data) {
      sendJson(res, 400, { error: 'Укажите название и данные набора' })
      return true
    }
    const preset = createPreset(body)
    sendJson(res, 201, preset)
    return true
  }

  const match = pathname.match(/^\/api\/presets\/([^/]+)$/)
  if (match) {
    const id = decodeURIComponent(match[1])
    const ownerToken = searchParams.get('ownerToken') ?? undefined

    if (method === 'GET') {
      const preset = getPresetById(id, ownerToken)
      if (!preset) {
        sendJson(res, 404, { error: 'Набор не найден или доступ запрещён' })
        return true
      }
      sendJson(res, 200, preset)
      return true
    }

    if (method === 'PUT') {
      const body = await readJsonBody<{
        ownerToken: string
        name?: string
        description?: string
        isPrivate?: boolean
        data?: CreatePresetInput['data']
      }>(req)
      if (!body.ownerToken) {
        sendJson(res, 400, { error: 'Требуется ownerToken' })
        return true
      }
      const updated = updatePreset(id, body.ownerToken, body)
      if (!updated) {
        sendJson(res, 404, { error: 'Набор не найден или доступ запрещён' })
        return true
      }
      sendJson(res, 200, updated)
      return true
    }

    if (method === 'DELETE') {
      const body = await readJsonBody<{ ownerToken: string }>(req)
      if (!body.ownerToken) {
        sendJson(res, 400, { error: 'Требуется ownerToken' })
        return true
      }
      const deleted = deletePreset(id, body.ownerToken)
      if (!deleted) {
        sendJson(res, 404, { error: 'Набор не найден или доступ запрещён' })
        return true
      }
      res.statusCode = 204
      res.end()
      return true
    }
  }

  return false
}
