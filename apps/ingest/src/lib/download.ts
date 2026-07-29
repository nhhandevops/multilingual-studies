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
