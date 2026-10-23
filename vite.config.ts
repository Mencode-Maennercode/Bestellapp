import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// Static multi-page build served from www.praesenzwert.de/Buchungssystem/.
// Every role has its own folder with an index.html, so links work on any static host without rewrites.
export default defineConfig({
  base: '/Buchungssystem/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@shared': resolve(__dirname, 'shared'), '@': resolve(__dirname, 'src') } },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        tisch: resolve(__dirname, 'tisch/index.html'),
        kellner: resolve(__dirname, 'kellner/index.html'),
        theke: resolve(__dirname, 'theke/index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
      },
    },
  },
});
