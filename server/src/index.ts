import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eventsRoute } from './events.js'
import { adminRoute } from './admin.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// In the production image dist/ lives at /app/dist (frontend) and /app/server/dist (backend).
// Server runs from /app/server/dist, so frontend dist is ../../dist relative to this file.
const FRONTEND_DIST = resolve(__dirname, '../../dist')

const app = new Hono()

app.get('/healthz', (c) => c.text('ok'))

app.route('/api/events', eventsRoute)
app.route('/api/admin', adminRoute)

// Any /api path that didn't match above is a real 404, not the SPA shell.
app.all('/api/*', (c) => c.json({ error: 'not found' }, 404))

// Vite puts all bundled assets under /assets/. Scope serveStatic here
// so it doesn't intercept healthz or API routes.
app.use(
  '/assets/*',
  serveStatic({
    root: FRONTEND_DIST,
    rewriteRequestPath: (path) => path,
  }),
)

// Everything else serves the SPA shell (react-router handles client routing).
app.get('*', async (c) => {
  const html = await readFile(resolve(FRONTEND_DIST, 'index.html'), 'utf8')
  return c.html(html)
})

const port = Number(process.env.PORT ?? 8081)
serve({ fetch: app.fetch, port })
console.log(`listening on :${port}`)
