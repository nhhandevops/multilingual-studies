/**
 * SQLite worker: owns the OPFS (opfs-sahpool VFS) databases and answers query RPCs.
 *
 * Three databases share the single 'mls-pool' SAH pool (one pool per origin — never
 * create a second worker or pool):
 *  - /content.db — read-only CORE pack. Lifecycle: read packs/manifest.json → compare with
 *    meta.pack_version in the installed DB → if different, download content.pack,
 *    gunzip, sha256-verify, importDb. Wholesale-replaced on every pack update.
 *  - /media.db — OPTIONAL media pack (v0.9): word-pronunciation blobs only. Its presence in
 *    the pool IS the opt-in record; installed via the 'install-media' RPC, auto-updated at
 *    init when the core pack updates, removable at any time. Never required for anything —
 *    a missing blob degrades to the labelled TTS voice.
 *  - /user.db — the learner's SRS state (cards/review_log/settings/daily_stats).
 *    Created + migrated here at init; NEVER touched by the pack update path.
 */
import sqlite3InitModule, { type Database, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { CardSnapshot, USER_MIGRATIONS, USER_SCHEMA_VERSION } from '@mls/shared/srs';

interface InitMsg { id: number; type: 'init'; base?: string }
interface QueryMsg { id: number; type: 'query'; sql: string; params?: unknown[] }
interface UserQueryMsg { id: number; type: 'user-query'; sql: string; params?: unknown[] }
interface UserExecMsg { id: number; type: 'user-exec'; statements: { sql: string; params?: unknown[] }[] }
interface UserExportMsg { id: number; type: 'user-export' }
interface UserImportMsg { id: number; type: 'user-import'; bytes: ArrayBuffer }
interface AudioBytesMsg { id: number; type: 'audio-bytes'; audioId: string }
interface AudioHasMsg { id: number; type: 'audio-has'; audioId: string }
interface InstallMediaMsg { id: number; type: 'install-media' }
interface RemoveMediaMsg { id: number; type: 'remove-media' }
interface CheckUpdateMsg { id: number; type: 'check-update' }
/** `final` = the page is really going away (not bfcache): release handles, then self-terminate. */
interface SuspendMsg { id: number; type: 'suspend'; final?: boolean }
interface ResumeMsg { id: number; type: 'resume' }
type InMsg =
  | InitMsg | QueryMsg | UserQueryMsg | UserExecMsg | UserExportMsg | UserImportMsg
  | AudioBytesMsg | AudioHasMsg | InstallMediaMsg | RemoveMediaMsg | CheckUpdateMsg
  | SuspendMsg | ResumeMsg;

/** Result of a post-boot update check (the boot path self-updates; this feeds the banner). */
export interface UpdateCheck {
  /** A newer pack exists that this app version can install. */
  available: boolean;
  packVersion: string | null;
  coreBytes: number | null;
  mediaBytes: number | null;
  /** The newest pack requires a newer app — update/reload the app first. */
  needsAppUpdate: boolean;
}

/** What the UI knows about the optional media pack. */
export interface MediaState {
  installed: boolean;
  /** Compressed download size from the manifest, null when the manifest has no media pack. */
  availableBytes: number | null;
}

const post = (msg: Record<string, unknown>, transfer?: Transferable[]) =>
  (self as unknown as Worker).postMessage(msg, transfer ?? []);
const progress = (phase: string, extra?: Record<string, unknown>) => {
  console.log('[sqlite.worker]', phase);
  post({ type: 'progress', phase, ...extra });
};

let sqlite3: Sqlite3Static | null = null;
let poolUtil: Awaited<ReturnType<Sqlite3Static['installOpfsSAHPoolVfs']>> | null = null;
let db: Database | null = null; // content.db
let userDb: Database | null = null; // user.db
let mediaDb: Database | null = null; // media.db — null when the media pack is not installed
/** Base path all pack fetches are relative to ('/' in dev, '/multilingual-studies/' on Pages). */
let basePath = '/';
/** The manifest from this session's init — install-media reuses it instead of re-fetching. */
let lastManifest: Manifest | null = null;
/** The pack version actually being served (set by init) — check-update compares against it. */
let effectiveVersion: string | null = null;

/** Injected by vite `define` into every chunk, workers included. */
declare const __APP_VERSION__: string;

/** Dotted-numeric version compare: -1 | 0 | 1. Non-numeric segments compare as 0. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((s) => Number(s) || 0);
  const pb = b.split('.').map((s) => Number(s) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** Does this app satisfy the manifest's minAppVersion? (Absent field = no requirement.) */
const minAppOk = (m: Manifest): boolean =>
  !m.minAppVersion || compareVersions(__APP_VERSION__, m.minAppVersion) >= 0;
/** Non-null while the VFS is paused for the back/forward cache — see suspend()/resume(). */
let suspension: Promise<void> | null = null;
let releaseSuspension: () => void = () => {};

interface Manifest {
  packVersion: string;
  dbSha256: string;
  dbBytes: number;
  minAppVersion?: string;
  media?: { file: string; sha256: string; bytes: number; blobCount: number };
}

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
  // Retrying is cheap but does NOT rescue the hard case: once installOpfsSAHPoolVfs has
  // failed, sqlite-wasm's own cleanup logs "removeVfs() failed with no recovery strategy"
  // and later attempts in the same document keep failing even after the holder lets go.
  // Measured: a document that had been playing audio holds the handles ~21 s past a reload,
  // and only a FRESH document recovers. So the ladder stays short (it wins the ordinary
  // teardown race) and the UI performs one automatic recovery reload — see app.tsx.
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

/** Read meta.pack_version from a pool DB file, null when absent/unreadable. */
function probeVersion(pool: NonNullable<typeof poolUtil>, file: string): string | null {
  try {
    const probe = new pool.OpfsSAHPoolDb(file);
    try {
      const row = probe.selectObject(`SELECT value FROM meta WHERE key = 'pack_version'`) as
        | { value: string }
        | undefined;
      return row?.value ?? null;
    } finally {
      probe.close();
    }
  } catch {
    return null; // no DB yet
  }
}

/**
 * Download a pack file, gunzip if needed, and verify size + sha256 against the manifest.
 * Some servers mark .gz files Content-Encoding: gzip and the browser pre-decompresses;
 * others serve raw bytes. Sniff the gzip magic (1f 8b) and decompress only if needed.
 */
async function fetchVerifiedPack(
  file: string,
  expected: { sha256: string; bytes: number },
  report: (phase: string, extra?: Record<string, unknown>) => void,
): Promise<ArrayBuffer> {
  report('download', { bytes: expected.bytes }); // real size — the UI shows honest MB
  const res = await fetch(`${basePath}packs/${file}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`pack download failed (HTTP ${res.status}) for ${file}`);
  let bytes = await res.arrayBuffer();
  const head = new Uint8Array(bytes, 0, 2);
  if (head[0] === 0x1f && head[1] === 0x8b) {
    const gunzipped = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = await new Response(gunzipped).arrayBuffer();
  }
  report('verify');
  if (bytes.byteLength !== expected.bytes)
    throw new Error(`pack size mismatch: ${bytes.byteLength} != ${expected.bytes}`);
  const sha = await sha256Hex(bytes);
  if (sha !== expected.sha256) throw new Error(`pack sha256 mismatch for ${file}`);
  return bytes;
}

/** Does the pool currently hold an installed media pack? (Presence IS the opt-in record.) */
function mediaFileExists(pool: NonNullable<typeof poolUtil>): boolean {
  try {
    return pool.getFileNames().includes('/media.db');
  } catch {
    return false;
  }
}

function mediaState(): MediaState {
  return {
    installed: mediaDb !== null,
    availableBytes: lastManifest?.media ? lastManifest.media.bytes : null,
  };
}

async function init(base: string): Promise<{ packVersion: string; media: MediaState }> {
  basePath = base.endsWith('/') ? base : `${base}/`;
  progress('sqlite');
  sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: console.error });
  poolUtil = await installPool(sqlite3);
  // Default pool capacity is 6; three DBs plus backup/import scratch files plus journal/temp
  // files need headroom. reserveMinimumCapacity is idempotent and persists in OPFS.
  await poolUtil.reserveMinimumCapacity(12);

  // What packs (if any) are already installed?
  const installed = probeVersion(poolUtil, '/content.db');
  const mediaInstalled = mediaFileExists(poolUtil) ? probeVersion(poolUtil, '/media.db') : null;

  progress('manifest');
  let manifest: Manifest | null = null;
  try {
    const manifestRes = await fetch(`${basePath}packs/manifest.json`, { cache: 'no-cache' });
    if (!manifestRes.ok) throw new Error(`no pack manifest (HTTP ${manifestRes.status}) — run: pnpm ingest pack publish`);
    manifest = (await manifestRes.json()) as Manifest;
  } catch (e) {
    // Offline / server gone: an already-installed pack keeps working (reviews must not
    // depend on the network). With no installed pack there is nothing to open — rethrow.
    if (installed === null) throw e;
  }
  // v0.9: a pack may require a newer app (manifest.minAppVersion, enforced at last).
  // With an install: keep serving it — the update banner explains. Without one there is
  // nothing usable to open; surface a recognisable error instead of broken screens.
  if (manifest && !minAppOk(manifest)) {
    if (installed === null) {
      throw new Error(`app-too-old: pack ${manifest.packVersion} requires app ${manifest.minAppVersion}`);
    }
    console.warn(`[sqlite.worker] pack ${manifest.packVersion} needs app ${manifest.minAppVersion} — keeping installed pack`);
    manifest = null; // do not install; installed pack keeps serving
  }
  // AFTER the gate, never before: lastManifest drives install-media, so retaining a gated
  // manifest would let the user install media belonging to a core pack we just refused.
  lastManifest = manifest;

  // Which version we actually end up serving — updated only when an install succeeds.
  let effective = installed;
  if (manifest && installed !== manifest.packVersion) {
    try {
      const bytes = await fetchVerifiedPack(
        'content.pack',
        { sha256: manifest.dbSha256, bytes: manifest.dbBytes },
        progress,
      );
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

  // Media pack: only ever touched when the user opted in (the file exists). Rides the core
  // update — same never-brick rule: a failed media refresh keeps the old blobs, which remain
  // mostly valid because audio IDs are stable across packs (invariant 1).
  if (mediaInstalled !== null && manifest?.media && mediaInstalled !== effective) {
    try {
      const bytes = await fetchVerifiedPack(
        manifest.media.file,
        { sha256: manifest.media.sha256, bytes: manifest.media.bytes },
        (phase) => post({ type: 'media-progress', phase }),
      );
      post({ type: 'media-progress', phase: 'install' });
      await poolUtil.importDb('/media.db', new Uint8Array(bytes));
    } catch (e) {
      console.error('[sqlite.worker] media update failed, keeping installed media:', e);
    }
  }

  db = new poolUtil.OpfsSAHPoolDb('/content.db');
  if (mediaFileExists(poolUtil)) mediaDb = new poolUtil.OpfsSAHPoolDb('/media.db');

  // user.db: created on first open, migrated forward on every init. Independent of the
  // pack lifecycle above — a pack reinstall never touches it.
  userDb = new poolUtil.OpfsSAHPoolDb('/user.db');
  migrateUserDb(userDb);

  effectiveVersion = effective!;
  return { packVersion: effective!, media: mediaState() };
}

/**
 * Post-boot update check for long-lived PWA sessions. Reports only — applying a CORE
 * update stays reload-based (the boot path is the verified installer and an in-session
 * swap would have to fence every in-flight content query).
 */
async function checkUpdate(): Promise<UpdateCheck> {
  const none: UpdateCheck = { available: false, packVersion: null, coreBytes: null, mediaBytes: null, needsAppUpdate: false };
  try {
    const res = await fetch(`${basePath}packs/manifest.json`, { cache: 'no-cache' });
    if (!res.ok) return none;
    const manifest = (await res.json()) as Manifest;
    if (manifest.packVersion === effectiveVersion) {
      lastManifest = manifest; // same pack: refreshed media availability is safe to keep
      return none;
    }
    // Gated manifests must NOT reach lastManifest — see init(). install-media would
    // otherwise pair a too-new media pack with the core pack we are still serving.
    if (!minAppOk(manifest)) return { ...none, needsAppUpdate: true, packVersion: manifest.packVersion };
    lastManifest = manifest;
    return {
      available: true,
      packVersion: manifest.packVersion,
      coreBytes: manifest.dbBytes,
      mediaBytes: manifest.media?.bytes ?? null,
      needsAppUpdate: false,
    };
  } catch {
    return none; // offline — nothing to report
  }
}

/** Opt in: download + verify + install the media pack, then open it. */
let mediaInstallInFlight: Promise<MediaState> | null = null;

async function installMedia(): Promise<MediaState> {
  // Two taps on the button must not run two downloads into the same pool file.
  if (mediaInstallInFlight) return mediaInstallInFlight;
  mediaInstallInFlight = doInstallMedia().finally(() => {
    mediaInstallInFlight = null;
  });
  return mediaInstallInFlight;
}

async function doInstallMedia(): Promise<MediaState> {
  if (!poolUtil) throw new Error('not initialized');
  if (mediaDb) return mediaState(); // already installed
  const manifest = lastManifest;
  // Defense in depth: the gate above already withholds a too-new manifest, so this can only
  // fire if that ever regresses — better a clear error than a silently skewed media pack.
  if (manifest && !minAppOk(manifest)) throw new Error('app-too-old: cannot install this media pack');
  const media = manifest?.media;
  if (!media) throw new Error('no media pack in the current manifest');
  const bytes = await fetchVerifiedPack(media.file, { sha256: media.sha256, bytes: media.bytes }, (phase) =>
    post({ type: 'media-progress', phase }),
  );
  post({ type: 'media-progress', phase: 'install' });
  await poolUtil.importDb('/media.db', new Uint8Array(bytes));
  mediaDb = new poolUtil.OpfsSAHPoolDb('/media.db');
  post({ type: 'media-progress', phase: 'done' });
  return mediaState();
}

/** Opt out: close and delete the media pack. Content and user data untouched. */
function removeMedia(): MediaState {
  if (!poolUtil) throw new Error('not initialized');
  mediaDb?.close();
  mediaDb = null;
  poolUtil.unlink('/media.db');
  return mediaState();
}

/** Blob lookup across media (word audio) then core (syllables/phones). */
function audioBytes(audioId: string): Uint8Array | null {
  for (const source of [mediaDb, db]) {
    if (!source) continue;
    try {
      const row = source.selectObject(`SELECT bytes FROM audio_blobs WHERE audio_id = ?`, [audioId]) as
        | { bytes: Uint8Array }
        | undefined;
      if (row?.bytes) return row.bytes;
    } catch {
      // e.g. a pre-split pack with no audio_blobs table — fall through
    }
  }
  return null;
}

function audioHas(audioId: string): boolean {
  for (const source of [mediaDb, db]) {
    if (!source) continue;
    try {
      const row = source.selectObject(`SELECT 1 AS hit FROM audio_blobs WHERE audio_id = ?`, [audioId]);
      if (row) return true;
    } catch {
      // table absent in this DB — fall through
    }
  }
  return false;
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
  mediaDb?.close();
  db = null;
  userDb = null;
  mediaDb = null;
  poolUtil.pauseVfs();
  progress('suspended');
}

async function resume(): Promise<void> {
  const pool = poolUtil;
  if (!pool || !pool.isPaused()) return;
  await pool.unpauseVfs();
  db = new pool.OpfsSAHPoolDb('/content.db');
  userDb = new pool.OpfsSAHPoolDb('/user.db');
  if (mediaFileExists(pool)) mediaDb = new pool.OpfsSAHPoolDb('/media.db');
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
      if (msg.final) {
        // A real unload/reload. The document may linger (a page that has played media lingers
        // for ~20 s, measured), and while this worker lives it holds the pool's EXCLUSIVE OPFS
        // handles, so the next document cannot open the database. Terminating now hands them
        // over immediately — there is nothing left to serve: the page that owns us is gone.
        post({ id: msg.id, ok: true, rows: [] });
        self.close();
        return;
      }
      // bfcache: stay alive, paused. Held until 'resume' so in-flight queries queue.
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
      const { packVersion, media } = await init(msg.base ?? '/');
      post({ id: msg.id, ok: true, packVersion, media });
    } else if (msg.type === 'audio-bytes') {
      const bytes = audioBytes(msg.audioId);
      if (bytes) {
        // Copy out of wasm-backed memory so the buffer is transferable.
        const copy = bytes.slice();
        post({ id: msg.id, ok: true, bytes: copy.buffer }, [copy.buffer]);
      } else {
        post({ id: msg.id, ok: true, bytes: null });
      }
    } else if (msg.type === 'audio-has') {
      post({ id: msg.id, ok: true, has: audioHas(msg.audioId) });
    } else if (msg.type === 'install-media') {
      const media = await installMedia();
      post({ id: msg.id, ok: true, media });
    } else if (msg.type === 'remove-media') {
      const media = removeMedia();
      post({ id: msg.id, ok: true, media });
    } else if (msg.type === 'check-update') {
      const update = await checkUpdate();
      post({ id: msg.id, ok: true, update });
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
