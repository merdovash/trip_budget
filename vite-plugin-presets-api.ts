import type { Plugin } from 'vite'
import { handlePresetsApi } from './server/presetsApi'

function presetsMiddleware() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req: any, res: any, next: () => void) => {
    if (!req.url?.startsWith('/api/presets')) {
      next()
      return
    }

    const url = new URL(req.url, 'http://localhost')
    handlePresetsApi(req, res, url.pathname, url.searchParams)
      .then((handled) => {
        if (!handled) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Not found' }))
        }
      })
      .catch(() => {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'Внутренняя ошибка сервера' }))
      })
  }
}

export function presetsApiPlugin(): Plugin {
  return {
    name: 'presets-api',
    configureServer(server) {
      server.middlewares.use(presetsMiddleware())
    },
    configurePreviewServer(server) {
      server.middlewares.use(presetsMiddleware())
    },
  }
}
