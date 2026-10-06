import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// VITE_BASE lets GitHub Pages serve the app under /<repo>/ ; hash routing needs no server rewrites.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
})
