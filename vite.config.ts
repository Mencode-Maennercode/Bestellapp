import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// Static multi-page build. Every role has its own folder with an index.html, so links work on any
// static host without rewrites.
//
//  • Default: the whole site (incl. admin) under www.praesenzwert.de/Buchungssystem/.
//  • Event build (scripts/build-event.mjs): only the guest, waiter, bar and legal pages for ONE event,
//    under its own folder (BUILD_BASE=/Hochzeit-Meier/) and locked to that event (VITE_EVENT_ID).
//    Deleting the folder afterwards kills every link of that event on the web host.
const eventBuild = process.env.EVENT_BUILD === '1';

export default defineConfig({
  base: process.env.BUILD_BASE ?? '/Buchungssystem/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@shared': resolve(__dirname, 'shared'), '@': resolve(__dirname, 'src') } },
  build: {
    target: 'es2022',
    outDir: process.env.BUILD_OUT ?? 'dist',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        tisch: resolve(__dirname, 'tisch/index.html'),
        kellner: resolve(__dirname, 'kellner/index.html'),
        theke: resolve(__dirname, 'theke/index.html'),
        ...(eventBuild ? {} : { admin: resolve(__dirname, 'admin/index.html') }),
        rechtliches: resolve(__dirname, 'rechtliches/index.html'),
      },
    },
  },
});
