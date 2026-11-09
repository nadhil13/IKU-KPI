import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createViteApiPlugin } from './backend/src/server.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), createViteApiPlugin()],
  server: {
    host: true,
    port: 5174,
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
})
