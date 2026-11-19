import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/build'
  },
  server: {
    proxy: {
      // faq-data.json is deliberately absent from public/ — it lives only in
      // S3 so a deploy can never overwrite the live-edited copy (see
      // docs/FAQ_DATA_EXTERNALIZATION.md). Without this proxy the dev server
      // answers the request with its SPA index.html fallback, and both the FAQ
      // and the admin FAQ Editor fail parsing it as JSON. Proxying to the live
      // origin also means an admin editing locally sees — and republishes —
      // the authoritative document rather than a stale local copy.
      '/faq-data.json': {
        target: 'https://phoenixdefi.app',
        changeOrigin: true,
      },
      // history.json is written only by the phusd-history-indexer Lambda
      // (lambda-history/) and lives only in S3, for the same reason as
      // faq-data.json; see docs/HISTORY_DATA.md.
      '/history.json': {
        target: 'https://phoenixdefi.app',
        changeOrigin: true,
      },
    },
  },
})
