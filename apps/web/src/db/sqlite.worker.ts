/**
 * SQLite worker: owns the OPFS (opfs-sahpool VFS) database and answers query RPCs.
 * Pack lifecycle: read /packs/manifest.json → compare with meta.pack_version in the
 * installed DB → if different, download content.db.gz, gunzip, sha256-verify, importDb.
 */
import sqlite3InitModule, { type Database, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';

interface InitMsg { id: number; type: 'init' }
interface QueryMsg { id: number; type: 'query'; sql: string; params?: unknown[] }
type InMsg = InitMsg | QueryMsg;

const post = (msg: Record<string, unknown>) => (self as unknown as Worker).postMessage(msg);
const progress = (phase: string) => {
  console.log('[sqlite.worker]', phase);
  post({ type: 'progress', phase });
};

let db: Database | null = null;

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function init(): Promise<{ packVersion: string }> {
  progress('sqlite');
  const sqlite3: Sqlite3Static = await sqlite3InitModule({ print: () => {}, printErr: console.error });
  const poolUtil = await sqlite3.installOpfsSAHPoolVfs({ name: 'mls-pool' });

  progress('manifest');
  const manifestRes = await fetch('/packs/manifest.json', { cache: 'no-cache' });
  if (!manifestRes.ok) throw new Error(`no pack manifest (HTTP ${manifestRes.status}) — run: pnpm ingest pack publish`);
  const manifest = (await manifestRes.json()) as { packVersion: string; dbSha256: string; dbBytes: number };

  // What pack (if any) is already installed?
  let installed: string | null = null;
  try {
    const probe = new poolUtil.OpfsSAHPoolDb('/content.db');
    try {
      const row = probe.selectObject(`SELECT value FROM meta WHERE key = 'pack_version'`) as
        | { value: string }
        | undefined;
      installed = row?.value ?? null;
    } finally {
      probe.close();
    }
  } catch {
    installed = null; // no DB yet
  }

  if (installed !== manifest.packVersion) {
    progress('download');
    const gzRes = await fetch('/packs/content.pack', { cache: 'no-cache' });
    if (!gzRes.ok) throw new Error(`pack download failed (HTTP ${gzRes.status})`);
    // Some servers mark .gz files Content-Encoding: gzip and the browser pre-decompresses;
    // others serve raw bytes. Sniff the gzip magic (1f 8b) and decompress only if needed.
    let bytes = await gzRes.arrayBuffer();
    const head = new Uint8Array(bytes, 0, 2);
    if (head[0] === 0x1f && head[1] === 0x8b) {
      const gunzipped = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      bytes = await new Response(gunzipped).arrayBuffer();
    }

    progress('verify');
    if (bytes.byteLength !== manifest.dbBytes)
      throw new Error(`pack size mismatch: ${bytes.byteLength} != ${manifest.dbBytes}`);
    const sha = await sha256Hex(bytes);
    if (sha !== manifest.dbSha256) throw new Error(`pack sha256 mismatch`);

    progress('install');
    await poolUtil.importDb('/content.db', new Uint8Array(bytes));
  }

  db = new poolUtil.OpfsSAHPoolDb('/content.db');
  return { packVersion: manifest.packVersion };
}

self.onmessage = async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'init') {
      const { packVersion } = await init();
      post({ id: msg.id, ok: true, packVersion });
    } else if (msg.type === 'query') {
      if (!db) throw new Error('db not initialized');
      const rows = db.selectObjects(msg.sql, (msg.params ?? []) as never);
      post({ id: msg.id, ok: true, rows });
    }
  } catch (e) {
    post({ id: msg.id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
};
