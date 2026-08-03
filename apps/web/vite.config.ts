import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  // '/' everywhere except the GitHub Pages project site, where the deploy workflow
  // sets MLS_BASE_PATH=/multilingual-studies/. The router basename and the worker's
  // pack fetches both derive from import.meta.env.BASE_URL, so this is the ONE knob.
  base: process.env.MLS_BASE_PATH ?? '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a mid-review controller swap is the wrong moment to reload — the
      // update banner (P3) offers it instead. Dev mode stays SW-free.
      registerType: 'prompt',
      injectRegister: 'auto',
      workbox: {
        // Precache the app shell ONLY. The content/media packs are versioned and
        // verified through packs/manifest.json into OPFS — a SW cache of them would
        // double-store 100+ MB and could poison downloads (see docs/RESEARCH-SOURCES.md).
        // png: the icons; txt AND TXT: licenses/ARPHICPL.TXT, which the Licenses screen
        // links to and which must stay readable offline (Arphic's licence requires shipping
        // its text). The uppercase variant is not decoration — workbox's glob is
        // case-sensitive on Linux (nocase defaults false on posix), so a Windows build
        // precached the file and the ubuntu-latest deploy build silently dropped it.
        globPatterns: ['**/*.{js,css,html,svg,png,txt,TXT,wasm,woff2}'],
        globIgnores: ['**/packs/**'],
        maximumFileSizeToCacheInBytes: 6_000_000, // sqlite wasm is ~1–2 MB
        navigateFallback: 'index.html',
        // Real files, not client routes: the SPA fallback must never answer for them.
        navigateFallbackDenylist: [/\/packs\//, /\/licenses\//],
        runtimeCaching: [
          {
            urlPattern: /\/packs\//,
            handler: 'NetworkOnly', // OPFS is the pack cache; offline uses the installed pack
          },
        ],
      },
      manifest: {
        name: 'Multilingual Studies',
        short_name: 'MLS',
        description: 'Học tiếng Anh · Trung · Pháp — offline, dữ liệu mở',
        lang: 'vi',
        display: 'standalone',
        background_color: '#171717',
        theme_color: '#0b6e4f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  // Required for @sqlite.org/sqlite-wasm: its wasm/worker loading breaks under dep pre-bundling.
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  // opfs-sahpool VFS needs NO COOP/COEP headers — plain static hosting works (the point of the design).
});
