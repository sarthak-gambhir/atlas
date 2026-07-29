import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The e2e run points the client at its own API on a separate port and database.
const apiTarget = process.env.ATLAS_API_URL ?? 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
