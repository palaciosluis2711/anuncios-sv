import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Expone el servidor en la red local (Wi-Fi) para acceso desde smartphones
    port: 5173,
  },
})
