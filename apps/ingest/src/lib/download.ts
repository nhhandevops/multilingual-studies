/**
 * Cached, verified downloads into data-cache/, with provenance recorded in sources.lock.json.
 * Re-running is a no-op when the cached file exists (delete the file to force a refresh).
 */
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DATA_CACHE, SOURCES_LOCK } from './paths';
import { polite } from './politeness';

interface LockArtifact {
  url: string;
  sha256: string;
  bytes: number;
  retrievedAt: string;
  license: string;
  notes?: string;
}

interface LockFile {
  $comment: string;
  artifacts: Record<string, LockArtifact>;
}

function readLock(): LockFile {
  return JSON.parse(readFileSync(SOURCES_LOCK, 'utf8')) as LockFile;
}

function writeLock(lock: LockFile): void {
  const sorted = Object.fromEntries(Object.entries(lock.artifacts).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(SOURCES_LOCK, JSON.stringify({ ...lock, artifacts: sorted }, null, 2) + '\n');
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * Record provenance for a *set* of downloads under one lock key.
 *
 * `download()` writes one lock entry per file, which is right for the handful of bulk files
 * every other source ships. Some sources are thousands of tiny files (audio-cmn: 1,707 mp3s)
 * where per-file entries would bury sources.lock.json — so the caller fetches them itself and
 * reports one aggregate entry. `sha256` must be computed over the files in a deterministic
 * order so an upstream change still shows up as a hash change.
 */
export function recordArtifactSet(opts: {
  id: string;
  url: string; //     the listing/base URL the set came from
  sha256: string; //   aggregate over sorted (name, bytes)
  bytes: number; //    total
  license: string;
  notes?: string;
}): void {
  const lock = readLock();
  const existing = lock.artifacts[opts.id];
  lock.artifacts[opts.id] = {
    url: opts.url,
    sha256: opts.sha256,
    bytes: opts.bytes,
    retrievedAt: existing && existing.sha256 === opts.sha256 ? existing.retrievedAt : new Date().toISOString(),
    license: opts.license,
    ...(opts.notes ? { notes: opts.notes } : {}),
  };
  if (existing && existing.sha256 !== opts.sha256) {
    console.warn(`  ! ${opts.id}: set changed since ${existing.retrievedAt}`);
  }
  writeLock(lock);
}

/**
 * Download `url` → data-cache/<relPath> unless already cached.
 * Records { id → url, sha256, license } in sources.lock.json either way.
 */
export async function download(opts: {
  id: string; //       lock key, e.g. 'cedict:cedict_1_0_ts_utf-8_mdbg.txt.gz'
  url: string;
  relPath: string; //  path under data-cache/
  license: string;
  notes?: string;
}): Promise<string> {
  const dest = join(DATA_CACHE, opts.relPath);
  mkdirSync(dirname(dest), { recursive: true });

  if (!existsSync(dest)) {
    console.log(`  ↓ ${opts.url}`);
    const res = await polite(opts.url);
    if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status} ${opts.url}`);
    const tmp = `${dest}.part`;
    await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), createWriteStream(tmp));
    // atomic-ish finalize
    const { renameSync } = await import('node:fs');
    renameSync(tmp, dest);
  } else {
    console.log(`  = cached ${opts.relPath}`);
  }

  const lock = readLock();
  const existing = lock.artifacts[opts.id];
  const sha = sha256File(dest);
  if (existing && existing.sha256 !== sha) {
    console.warn(`  ! ${opts.id}: content changed since ${existing.retrievedAt} (${existing.sha256.slice(0, 12)} → ${sha.slice(0, 12)})`);
  }
  lock.artifacts[opts.id] = {
    url: opts.url,
    sha256: sha,
    bytes: statSync(dest).size,
    retrievedAt: existing && existing.sha256 === sha ? existing.retrievedAt : new Date().toISOString(),
    license: opts.license,
    ...(opts.notes ? { notes: opts.notes } : {}),
  };
  writeLock(lock);
  return dest;
}
