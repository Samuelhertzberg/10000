import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base = process.env.DEPLOY_TARGET === 'gh-pages' ? '/10000/' : '/'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base,
  server: {
    proxy: {
      '/api': 'http://localhost:8081',
    },
  },
})
