import type { IncomingMessage, ServerResponse } from 'node:http'
import type { CreatePresetInput } from '../src/types/preset'
import { getUserFromRequest } from './auth/session'
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
  const chunks: Uint8Array[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  // Node Buffer#toString() defaults to utf8; avoid encoding arg (Uint8Array overload clash).
  const raw = Buffer.concat(chunks).toString()
  return JSON.parse(raw || '{}') as T
}

export async function handlePresetsApi(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  const method = req.method ?? 'GET'
  const user = await getUserFromRequest(req)

  if (pathname === '/api/presets' && method === 'GET') {
    sendJson(res, 200, await listPublicPresets())
    return true
  }

  if (pathname === '/api/presets/mine' && method === 'GET') {
    if (!user) {
      sendJson(res, 401, { error: 'Требуется вход' })
      return true
    }
    sendJson(res, 200, await listOwnedPresets(user.id))
    return true
  }

  if (pathname === '/api/presets' && method === 'POST') {
    if (!user) {
      sendJson(res, 401, { error: 'Требуется вход' })
      return true
    }
    const body = await readJsonBody<CreatePresetInput>(req)
    if (!body.name?.trim() || !body.data) {
      sendJson(res, 400, { error: 'Укажите название и данные набора' })
      return true
    }
    const preset = await createPreset(user.id, body)
    sendJson(res, 201, preset)
    return true
  }

  const match = pathname.match(/^\/api\/presets\/([^/]+)$/)
  if (match) {
    const id = decodeURIComponent(match[1]!)

    if (method === 'GET') {
      const preset = await getPresetById(id, user?.id)
      if (!preset) {
        sendJson(res, 404, { error: 'Набор не найден или доступ запрещён' })
        return true
      }
      sendJson(res, 200, preset)
      return true
    }

    if (method === 'PUT') {
      if (!user) {
        sendJson(res, 401, { error: 'Требуется вход' })
        return true
      }
      const body = await readJsonBody<{
        name?: string
        description?: string
        isPrivate?: boolean
        data?: CreatePresetInput['data']
      }>(req)
      const updated = await updatePreset(id, user.id, body)
      if (!updated) {
        sendJson(res, 404, { error: 'Набор не найден или доступ запрещён' })
        return true
      }
      sendJson(res, 200, updated)
      return true
    }

    if (method === 'DELETE') {
      if (!user) {
        sendJson(res, 401, { error: 'Требуется вход' })
        return true
      }
      const deleted = await deletePreset(id, user.id)
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
