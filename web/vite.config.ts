import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Pages are paths, so the host must serve index.html for every path; web/vercel.json does that for tivan.store.
export default defineConfig({
  plugins: [react()],
  // `vite preview` sends the same security headers as tivan.store, so a Content-Security-Policy change is tested locally.
  preview: {
    headers: Object.fromEntries(
      (JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')).headers[0].headers as { key: string; value: string }[]).map((h) => [h.key, h.value]),
    ),
  },
})
