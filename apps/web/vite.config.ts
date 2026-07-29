import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Required for @sqlite.org/sqlite-wasm: its wasm/worker loading breaks under dep pre-bundling.
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  // opfs-sahpool VFS needs NO COOP/COEP headers — plain static hosting works (the point of the design).
});
