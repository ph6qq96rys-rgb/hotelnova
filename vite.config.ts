import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      // Proxy all /api requests to the .NET backend during development.
      // In production, Nginx handles this — see nginx.conf.
      '/api': {
        target: 'http://localhost:5009',
        changeOrigin: true,
      },
    },
  },
})