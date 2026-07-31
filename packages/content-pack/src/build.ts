/**
 * Pack builder: build/staging.db → packs/<version>/{content.db.gz, manifest.json}
 * Steps: copy → strip ingest-only tables → rebuild FTS → optimize → VACUUM → gzip → manifest.
 */
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { PackManifest } from '@mls/shared';

export const SCHEMA_VERSION = 1;
export const MIN_APP_VERSION = '0.1.0';

const COUNTED_TABLES = [
  'words', 'senses', 'sentences', 'word_sentences', 'graphemes', 'hanzi_info',
  'grammar_topics', 'tech_terms', 'daily_items', 'tips', 'audio', 'audio_blobs', 'asset_blobs', 'word_audio', 'sources',
] as const;

/** '2026.07.29-1', bumping -N if the same date already exists in packsDir. */
export function nextPackVersion(packsDir: string, today: Date): string {
  const date = today.toISOString().slice(0, 10).replaceAll('-', '.');
  for (let n = 1; ; n++) {
    const candidate = `${date}-${n}`;
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

  const dbBytes = readFileSync(contentDbPath);
  const gz = gzipSync(dbBytes, { level: 9 });
  writeFileSync(join(outDir, 'content.db.gz'), gz);

  const countsDb = new Database(contentDbPath, { readonly: true });
  const counts: Record<string, number> = {};
  try {
    for (const t of COUNTED_TABLES) {
      counts[t] = (countsDb.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
    }
  } finally {
    countsDb.close();
  }

  const manifest: PackManifest = {
    packVersion,
    schemaVersion: SCHEMA_VERSION,
    minAppVersion: MIN_APP_VERSION,
    dbSha256: createHash('sha256').update(dbBytes).digest('hex'),
    dbBytes: dbBytes.length,
    counts,
  };
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  // content.db (uncompressed) is kept beside the gz for local inspection/verify.
  return { manifest, outDir };
}
