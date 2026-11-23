import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const BUILD_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const BUILT_AT = new Date().toISOString()

function lazyBackendApiPlugin() {
  return {
    name: 'performa-itpln-realtime-backend',
    async configureServer(server) {
      const { createViteApiPlugin } = await import('./backend/src/server.js')
      createViteApiPlugin().configureServer(server)
    },
    async configurePreviewServer(server) {
      const { createViteApiPlugin } = await import('./backend/src/server.js')
      createViteApiPlugin().configurePreviewServer(server)
    },
  }
}

function performaVersionStampPlugin() {
  const versionPayload = JSON.stringify({ buildId: BUILD_ID, builtAt: BUILT_AT })
  return {
    name: 'performa-version-stamp',
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store, max-age=0')
        res.end(versionPayload)
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: versionPayload,
      })
    },
  }
}

export default defineConfig({
  define: {
    __PERFORMA_BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [react(), lazyBackendApiPlugin(), performaVersionStampPlugin()],
  server: {
    host: true,
    port: 5174,
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
})
