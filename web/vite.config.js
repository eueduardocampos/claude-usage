import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// O build sai em dist/ e e servido pelo server.py do painel.
// No dev (npm run dev), /api e /auth sao redirecionados para o backend Python.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8090',
      '/auth': 'http://localhost:8090',
    },
  },
  build: { outDir: 'dist' },
});
