/**
 * SQLite worker: owns the OPFS (opfs-sahpool VFS) databases and answers query RPCs.
 *
 * Two databases share the single 'mls-pool' SAH pool (one pool per origin — never
 * create a second worker or pool):
 *  - /content.db — read-only pack. Lifecycle: read /packs/manifest.json → compare with
 *    meta.pack_version in the installed DB → if different, download content.db.gz,
 *    gunzip, sha256-verify, importDb. Wholesale-replaced on every pack update.
 *  - /user.db — the learner's SRS state (cards/review_log/settings/daily_stats).
 *    Created + migrated here at init; NEVER touched by the pack update path.
 */
import sqlite3InitModule, { type Database, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { CardSnapshot, USER_MIGRATIONS, USER_SCHEMA_VERSION } from '@mls/shared/srs';

interface InitMsg { id: number; type: 'init' }
interface QueryMsg { id: number; type: 'query'; sql: string; params?: unknown[] }
interface UserQueryMsg { id: number; type: 'user-query'; sql: string; params?: unknown[] }
interface UserExecMsg { id: number; type: 'user-exec'; statements: { sql: string; params?: unknown[] }[] }
interface UserExportMsg { id: number; type: 'user-export' }
interface UserImportMsg { id: number; type: 'user-import'; bytes: ArrayBuffer }
interface SuspendMsg { id: number; type: 'suspend' }
interface ResumeMsg { id: number; type: 'resume' }
type InMsg =
  | InitMsg | QueryMsg | UserQueryMsg | UserExecMsg | UserExportMsg | UserImportMsg
  | SuspendMsg | ResumeMsg;

const post = (msg: Record<string, unknown>, transfer?: Transferable[]) =>
  (self as unknown as Worker).postMessage(msg, transfer ?? []);
const progress = (phase: string) => {
  console.log('[sqlite.worker]', phase);
  post({ type: 'progress', phase });
};

let sqlite3: Sqlite3Static | null = null;
let poolUtil: Awaited<ReturnType<Sqlite3Static['installOpfsSAHPoolVfs']>> | null = null;
let db: Database | null = null; // content.db
let userDb: Database | null = null; // user.db
/** Non-null while the VFS is paused for the back/forward cache — see suspend()/resume(). */
let suspension: Promise<void> | null = null;
let releaseSuspension: () => void = () => {};

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Apply pending user.db migrations (PRAGMA user_version tracks progress). */
function migrateUserDb(u: Database): void {
  const version = Number(u.selectValue('PRAGMA user_version') ?? 0);
  if (version > USER_SCHEMA_VERSION) {
    throw new Error(`user.db schema v${version} is newer than this app supports (v${USER_SCHEMA_VERSION})`);
  }
  for (let i = version; i < USER_MIGRATIONS.length; i++) {
    u.exec('BEGIN');
    try {
      u.exec(USER_MIGRATIONS[i]!);
      u.exec(`PRAGMA user_version = ${i + 1}`);
      u.exec('COMMIT');
    } catch (e) {
      try {
        u.exec('ROLLBACK');
      } catch {
        // txn already rolled back (e.g. SQLITE_FULL auto-rollback) — keep the original error
      }
      throw e;
    }
  }
}

/** Recognised by the UI to offer a Reload button instead of a raw exception. */
export const STORAGE_LOCKED = 'storage-locked';

/**
 * opfs-sahpool takes *exclusive* OPFS sync access handles, one holder per origin.
 *
 * Two situations produce "Access Handles cannot be created…":
 *  1. A brief teardown race on reload — the old worker still has them. Retrying wins.
 *  2. Another live document holds them: a second tab, or — measured, not theorised — a page
 *     Chrome kept in the back/forward cache. A frozen page cannot run code, so it can neither
 *     be asked to release them nor release them itself; it holds on indefinitely (>20 s
 *     observed). Retrying cannot win, so we stop and let the UI offer a reload, which does
 *     recover. The real fix is a takeover protocol (see HANDOFF "Next up").
 */
async function installPool(sqlite3: Sqlite3Static): Promise<NonNullable<typeof poolUtil>> {
  const DELAYS_MS = [0, 60, 120, 250, 500, 900, 1500, 2500, 2500];
  let lastError: unknown;
  for (const delay of DELAYS_MS) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    try {
      return await sqlite3.installOpfsSAHPoolVfs({ name: 'mls-pool' });
    } catch (e) {
      lastError = e;
      if (!/Access Handles|createSyncAccessHandle|NoModificationAllowed/i.test(String(e))) throw e;
      progress('waiting-for-storage');
    }
  }
  throw new Error(`${STORAGE_LOCKED}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function init(): Promise<{ packVersion: string }> {
  progress('sqlite');
  sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: console.error });
  poolUtil = await installPool(sqlite3);
  // Default pool capacity is 6; two DBs plus journal/temp files need headroom.
  // reserveMinimumCapacity is idempotent and persists in OPFS.
  await poolUtil.reserveMinimumCapacity(8);

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

  progress('manifest');
  let manifest: { packVersion: string; dbSha256: string; dbBytes: number } | null = null;
  try {
    const manifestRes = await fetch('/packs/manifest.json', { cache: 'no-cache' });
    if (!manifestRes.ok) throw new Error(`no pack manifest (HTTP ${manifestRes.status}) — run: pnpm ingest pack publish`);
    manifest = (await manifestRes.json()) as { packVersion: string; dbSha256: string; dbBytes: number };
  } catch (e) {
    // Offline / server gone: an already-installed pack keeps working (reviews must not
    // depend on the network). With no installed pack there is nothing to open — rethrow.
    if (installed === null) throw e;
  }

  // Which version we actually end up serving — updated only when an install succeeds.
  let effective = installed;
  if (manifest && installed !== manifest.packVersion) {
    try {
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
      effective = manifest.packVersion;
    } catch (e) {
      // A failed UPDATE must not brick a working install: keep serving the
      // installed pack (reviews keep working); retry happens on next launch.
      if (installed === null) throw e;
      console.error('[sqlite.worker] pack update failed, keeping installed pack:', e);
    }
  } else if (manifest) {
    effective = manifest.packVersion;
  }

  db = new poolUtil.OpfsSAHPoolDb('/content.db');

  // user.db: created on first open, migrated forward on every init. Independent of the
  // pack lifecycle above — a pack reinstall never touches it.
  userDb = new poolUtil.OpfsSAHPoolDb('/user.db');
  migrateUserDb(userDb);

  return { packVersion: effective! };
}

/** Run statements atomically against user.db. */
function userExec(statements: { sql: string; params?: unknown[] }[]): void {
  if (!userDb) throw new Error('user db not initialized');
  userDb.exec('BEGIN IMMEDIATE');
  try {
    for (const s of statements) {
      userDb.exec({ sql: s.sql, bind: (s.params ?? []) as never });
    }
    userDb.exec('COMMIT');
  } catch (e) {
    try {
      userDb.exec('ROLLBACK');
    } catch {
      // txn already rolled back (e.g. SQLITE_FULL auto-rollback) — keep the original error
    }
    throw e;
  }
}

function userExport(): Uint8Array {
  if (!sqlite3 || !userDb) throw new Error('user db not initialized');
  return sqlite3.capi.sqlite3_js_db_export(userDb);
}

/**
 * Replace user.db with imported bytes. Two-stage for safety:
 *  1. Validate the candidate under a scratch pool name — /user.db is untouched, so a
 *     bad file (wrong schema, corrupt, or some random SQLite DB like content.db) is
 *     rejected with zero risk. Validation checks the file AS-IS (schema version and
 *     tables BEFORE migrating — migration would otherwise manufacture the very tables
 *     the check looks for), then proves pending migrations apply cleanly.
 *  2. Swap in, keeping a persistent backup (/user-backup.db) so even a crash or I/O
 *     error mid-swap can't lose the previous progress.
 */
async function userImport(bytes: ArrayBuffer): Promise<void> {
  if (!sqlite3 || !poolUtil || !userDb) throw new Error('user db not initialized');
  const pool = poolUtil;
  if (bytes.byteLength < 100) throw new Error('not an SQLite database file');
  const header = new TextDecoder().decode(new Uint8Array(bytes, 0, 15));
  if (header !== 'SQLite format 3') throw new Error('not an SQLite database file');

  // 1. validate on a scratch copy
  try {
    await pool.importDb('/user-import-tmp.db', new Uint8Array(bytes));
    const tmp = new pool.OpfsSAHPoolDb('/user-import-tmp.db');
    try {
      if (tmp.selectValue('PRAGMA integrity_check') !== 'ok') throw new Error('integrity check failed');
      const version = Number(tmp.selectValue('PRAGMA user_version') ?? 0);
      // Every genuine export has version >= 1: init() migrates user.db before export is possible.
      if (version < 1) throw new Error('not a user.db backup (no schema version)');
      if (version > USER_SCHEMA_VERSION)
        throw new Error(`user.db schema v${version} is newer than this app supports (v${USER_SCHEMA_VERSION})`);
      const n = tmp.selectValue(
        `SELECT count(*) FROM sqlite_master WHERE name IN ('cards','review_log','settings','daily_stats')`,
      );
      if (Number(n) !== 4) throw new Error('missing user.db tables');
      migrateUserDb(tmp); // prove an older genuine backup migrates cleanly
      const rows = tmp.selectObjects('SELECT id, snapshot FROM cards') as { id: string; snapshot: string }[];
      for (const row of rows) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(row.snapshot);
        } catch {
          throw new Error(`card ${row.id}: snapshot is not valid JSON`);
        }
        if (!CardSnapshot.safeParse(parsed).success) throw new Error(`card ${row.id}: malformed snapshot`);
      }
    } finally {
      tmp.close();
    }
  } catch (e) {
    pool.unlink('/user-import-tmp.db');
    throw new Error(`import rejected (progress unchanged): ${e instanceof Error ? e.message : String(e)}`);
  }
  pool.unlink('/user-import-tmp.db');

  // 2. swap in, persistent backup first
  const backup = sqlite3.capi.sqlite3_js_db_export(userDb);
  await pool.importDb('/user-backup.db', backup);
  userDb.close();
  userDb = null;
  try {
    await pool.importDb('/user.db', new Uint8Array(bytes));
    userDb = new pool.OpfsSAHPoolDb('/user.db');
    migrateUserDb(userDb);
  } catch (e) {
    // The validated import still failed mid-write — restore from the in-memory backup
    // (the persistent /user-backup.db additionally survives a worker crash here).
    try {
      userDb?.close();
    } catch {
      // not open
    }
    userDb = null;
    await pool.importDb('/user.db', backup);
    userDb = new pool.OpfsSAHPoolDb('/user.db');
    throw new Error(`import failed, previous data restored: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Release the pool's OPFS handles without touching the data (`pauseVfs`, NOT `wipeFiles`).
 *
 * Why this exists: a page frozen into the back/forward cache keeps its worker alive, and
 * opfs-sahpool handles are exclusive per origin. Without this, loading any other document
 * and then pressing Back leaves two live workers fighting over the same files and the
 * restored page dies with "Access Handles cannot be created…". Both databases must be
 * closed before pausing and reopened after unpausing — that is the documented contract.
 */
function suspend(): void {
  if (!poolUtil || suspension) return;
  db?.close();
  userDb?.close();
  db = null;
  userDb = null;
  poolUtil.pauseVfs();
  progress('suspended');
}

async function resume(): Promise<void> {
  const pool = poolUtil;
  if (!pool || !pool.isPaused()) return;
  await pool.unpauseVfs();
  db = new pool.OpfsSAHPoolDb('/content.db');
  userDb = new pool.OpfsSAHPoolDb('/user.db');
  progress('resumed');
}

/** Queries that arrive while paused wait for the resume rather than failing. */
async function awaitResume(): Promise<void> {
  while (suspension) await suspension;
}

self.onmessage = async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'suspend') {
      suspend();
      // Held until 'resume' arrives so in-flight queries queue instead of erroring.
      let release = (): void => {};
      suspension = new Promise<void>((r) => { release = r; });
      releaseSuspension = release;
      post({ id: msg.id, ok: true, rows: [] });
      return;
    }
    if (msg.type === 'resume') {
      await resume();
      suspension = null;
      releaseSuspension();
      releaseSuspension = () => {};
      post({ id: msg.id, ok: true, rows: [] });
      return;
    }
    if (msg.type !== 'init') await awaitResume();
    if (msg.type === 'init') {
      const { packVersion } = await init();
      post({ id: msg.id, ok: true, packVersion });
    } else if (msg.type === 'query') {
      if (!db) throw new Error('db not initialized');
      const rows = db.selectObjects(msg.sql, (msg.params ?? []) as never);
      post({ id: msg.id, ok: true, rows });
    } else if (msg.type === 'user-query') {
      if (!userDb) throw new Error('user db not initialized');
      const rows = userDb.selectObjects(msg.sql, (msg.params ?? []) as never);
      post({ id: msg.id, ok: true, rows });
    } else if (msg.type === 'user-exec') {
      userExec(msg.statements);
      post({ id: msg.id, ok: true, rows: [] });
    } else if (msg.type === 'user-export') {
      const bytes = userExport();
      post({ id: msg.id, ok: true, bytes: bytes.buffer }, [bytes.buffer]);
    } else if (msg.type === 'user-import') {
      await userImport(msg.bytes);
      post({ id: msg.id, ok: true, rows: [] });
    }
  } catch (e) {
    post({ id: msg.id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
};
