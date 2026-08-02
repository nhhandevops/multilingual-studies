// Plain static server for dist/ — no file watcher, so the pack can be swapped mid-test
// (Vite's watcher dies with EBUSY when content.pack is overwritten on Windows).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { REPO } from './paths.mjs';
const ROOT = `${REPO}/apps/web/dist`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.wasm': 'application/wasm', '.json': 'application/json', '.pack': 'application/octet-stream',
  '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json' };
createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let path = join(ROOT, url);
  try {
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
  } catch {
    path = join(ROOT, 'index.html'); // SPA fallback
  }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch (e) {
    res.writeHead(404); res.end('not found');
  }
}).listen(5199, () => console.log('static server on http://localhost:5199'));
