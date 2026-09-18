import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Honour PORT so the dev server can be started on an assigned free port
// instead of always claiming 5173.
const port = Number(process.env.PORT) || undefined

export default defineConfig({
  plugins: [react()],
  server: {
    port,
    // When a port was handed to us, fail loudly rather than silently drifting
    // to another one the caller is not watching.
    strictPort: port !== undefined,
  },
})
