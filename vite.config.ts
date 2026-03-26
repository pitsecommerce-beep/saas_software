import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Use '/' in production (Railway), '/saas_software/' for local GitHub Pages dev
  base: process.env.VITE_BASE_PATH ?? '/saas_software/',
})
