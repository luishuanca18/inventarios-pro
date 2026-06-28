import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Permite abrir la app desde hosts temporales como Cloudflare Tunnel mientras hacemos pruebas.
  server: {
    allowedHosts: true,
  },
})
