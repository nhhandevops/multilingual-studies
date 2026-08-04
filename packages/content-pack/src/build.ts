/**
 * Pack builder: build/staging.db → packs/<version>/{content.db.gz, media.db.gz, manifest.json}
 * Steps: copy → strip ingest-only tables → SPLIT MEDIA → rebuild FTS → VACUUM → gzip → manifest.
 *
 * The split (v0.9): word-pronunciation blobs — ~78 MB of the 130 MB pack — move into an
 * optional second file so a phone install is ~52 MB instead of 130. It is a PACKAGING
 * decision made here, at build time: staging keeps every blob, no seed re-runs, no schema
 * change, and the audio IDs are untouched (invariant 1), so the two files stay joinable.
 *
 * What stays in core, deliberately:
 *  - syllable blobs (7.5 MB): the pinyin chart is a core learning surface and v0.3's
 *    acceptance asserts all 1,707 syllables play. A silent chart would be a regression.
 *  - sentence blobs (1 MB): Tex's French Grammar clips, tied to grammar pages.
 *  - asset_blobs (sagittal SVGs): tiny, and the IPA chart is core.
 *  - the whole `audio` METADATA table: the app must know a recording exists (to offer the
 *    media pack) and its credit must ship wherever it is referenced — a licence obligation.
 */
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { PackManifest } from '@mls/shared';

export const SCHEMA_VERSION = 1;
/** v0.9 splits the media pack; older apps would show silent buttons for word audio. */
export const MIN_APP_VERSION = '0.9.0';
/** Audio kinds whose blobs move to the optional media pack. */
const MEDIA_KINDS = ['word'] as const;
export const MEDIA_FILE = 'media.pack';

const COUNTED_TABLES = [
  'words', 'senses', 'sentences', 'word_sentences', 'graphemes', 'hanzi_info',
  'grammar_topics', 'tech_terms', 'daily_items', 'tips', 'audio', 'audio_blobs', 'asset_blobs', 'word_audio', 'sources',
] as const;

/**
 * '2026.07.29-1', bumping -N past anything already built HERE or already published ANYWHERE.
 *
 * `packsDir` alone is not enough, and the gap is not theoretical: `build/` is gitignored, so a
 * second clone that pulls the repo sees none of the first clone's builds and mints `-1` again.
 * On 2026-08-04 that produced two different packs both calling themselves `2026.08.04-1` — and
 * because the app's update check compares this string, a learner holding one of them would have
 * been told they were up to date while the other shipped.
 *
 * `reserved` is the published ledger (packs.lock.json), which IS committed, so a clone that
 * pulls before building cannot reuse a name. Two clones that both build without syncing can
 * still collide — that is a workflow the ledger cannot fix, only make visible.
 */
export function nextPackVersion(packsDir: string, today: Date, reserved: Iterable<string> = []): string {
  const date = today.toISOString().slice(0, 10).replaceAll('-', '.');
  const taken = new Set(reserved);
  for (let n = 1; ; n++) {
    const candidate = `${date}-${n}`;
    if (taken.has(candidate)) continue;
    try {
      readFileSync(join(packsDir, candidate, 'manifest.json'));
    } catch {
      return candidate;
    }
  }
}

export interface BuildResult {
  manifest: PackManifest;
  outDir: string;
}

export function buildPack(opts: {
  stagingDbPath: string;
  packsDir: string;
  packVersion: string;
}): BuildResult {
  const { stagingDbPath, packsDir, packVersion } = opts;
  const outDir = join(packsDir, packVersion);
  mkdirSync(outDir, { recursive: true });

  const contentDbPath = join(outDir, 'content.db');
  rmSync(contentDbPath, { force: true });
  // Flush staging WAL before copying the file.
  const staging = new Database(stagingDbPath);
  staging.pragma('wal_checkpoint(TRUNCATE)');
  staging.close();
  copyFileSync(stagingDbPath, contentDbPath);

  const db = new Database(contentDbPath);
  try {
    db.pragma('journal_mode = DELETE'); // packs ship as a single file, no WAL sidecars
    db.exec(`DROP TABLE IF EXISTS ingest_runs;`);

    // Rebuild FTS from scratch — staging never populates it. Contentless ⇒ 'delete-all', not DELETE.
    db.exec(`INSERT INTO words_fts(words_fts) VALUES('delete-all');`);
    db.exec(`
      INSERT INTO words_fts (word_id, headword, alt_form, reading_plain, glosses)
      SELECT w.id, w.headword, COALESCE(w.alt_form,''),
             COALESCE(w.reading,''),
             COALESCE((SELECT group_concat(s.gloss_en, ' | ') FROM senses s WHERE s.word_id = w.id), '')
      FROM words w;`);
    db.exec(`INSERT INTO sentences_fts(sentences_fts) VALUES('delete-all');`);
    db.exec(`
      INSERT INTO sentences_fts (sentence_id, text, trans_en)
      SELECT id, text, COALESCE(trans_en,'') FROM sentences;`);

    const setMeta = db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?)
                                ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
    setMeta.run('schema_version', String(SCHEMA_VERSION));
    setMeta.run('pack_version', packVersion);
    setMeta.run('min_app_version', MIN_APP_VERSION);
    setMeta.run('built_at', new Date().toISOString());

    db.exec(`INSERT INTO words_fts(words_fts) VALUES('optimize');`);
    db.exec(`INSERT INTO sentences_fts(sentences_fts) VALUES('optimize');`);
    db.exec('VACUUM;');
  } finally {
    db.close();
  }

  const mediaDbPath = join(outDir, 'media.db');
  const mediaBlobCount = splitMedia(contentDbPath, mediaDbPath, packVersion);

  const dbBytes = readFileSync(contentDbPath);
  writeFileSync(join(outDir, 'content.db.gz'), gzipSync(dbBytes, { level: 9 }));
  const mediaBytes = readFileSync(mediaDbPath);
  writeFileSync(join(outDir, 'media.db.gz'), gzipSync(mediaBytes, { level: 9 }));

  const countsDb = new Database(contentDbPath, { readonly: true });
  const counts: Record<string, number> = {};
  try {
    for (const t of COUNTED_TABLES) {
      counts[t] = (countsDb.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
    }
  } finally {
    countsDb.close();
  }
  counts['media_blobs'] = mediaBlobCount;

  const manifest: PackManifest = {
    packVersion,
    schemaVersion: SCHEMA_VERSION,
    minAppVersion: MIN_APP_VERSION,
    dbSha256: createHash('sha256').update(dbBytes).digest('hex'),
    dbBytes: dbBytes.length,
    counts,
    media: {
      file: MEDIA_FILE,
      sha256: createHash('sha256').update(mediaBytes).digest('hex'),
      bytes: mediaBytes.length,
      blobCount: mediaBlobCount,
    },
  };
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  // content.db / media.db (uncompressed) are kept beside the gz files for verify + inspection.
  return { manifest, outDir };
}

/**
 * Move word-audio blobs out of `content.db` into a fresh `media.db`, and VACUUM the hole shut.
 * Returns the number of blobs moved. The media file carries only what it needs to be
 * self-identifying (meta.pack_version, so a skewed pair is detectable) plus the blobs.
 */
function splitMedia(contentDbPath: string, mediaDbPath: string, packVersion: string): number {
  rmSync(mediaDbPath, { force: true });
  const media = new Database(mediaDbPath);
  let moved = 0;
  try {
    media.pragma('journal_mode = DELETE');
    media.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE audio_blobs (
        audio_id TEXT PRIMARY KEY,
        bytes    BLOB NOT NULL
      ) WITHOUT ROWID;`);
    const setMeta = media.prepare(`INSERT INTO meta (key, value) VALUES (?, ?)`);
    setMeta.run('pack_version', packVersion); // must equal core's — verify checks the pair
    setMeta.run('media_schema_version', '1');
    setMeta.run('built_at', new Date().toISOString());

    const kinds = MEDIA_KINDS.map(() => '?').join(',');
    media.exec(`ATTACH DATABASE '${contentDbPath.replaceAll("'", "''")}' AS core`);
    try {
      const info = media
        .prepare(
          `INSERT INTO audio_blobs (audio_id, bytes)
           SELECT b.audio_id, b.bytes FROM core.audio_blobs b
             JOIN core.audio a ON a.id = b.audio_id
            WHERE a.kind IN (${kinds})`,
        )
        .run(...MEDIA_KINDS);
      moved = info.changes;
      media
        .prepare(
          `DELETE FROM core.audio_blobs
            WHERE audio_id IN (SELECT id FROM core.audio WHERE kind IN (${kinds}))`,
        )
        .run(...MEDIA_KINDS);
    } finally {
      media.exec('DETACH DATABASE core');
    }
    media.exec('VACUUM;');
  } finally {
    media.close();
  }

  // Reclaim the pages the moved blobs occupied — without this the core file keeps its size.
  const core = new Database(contentDbPath);
  try {
    core.exec('VACUUM;');
  } finally {
    core.close();
  }
  return moved;
}
