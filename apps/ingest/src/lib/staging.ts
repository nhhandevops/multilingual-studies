/** Opens build/staging.db, applying schema.sql + the ingest-only ingest_runs table. */
import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import type { Source } from '@mls/shared';
import { BUILD_DIR, SCHEMA_SQL, STAGING_DB } from './paths';

export type DB = Database.Database;

export function openStaging(): DB {
  mkdirSync(BUILD_DIR, { recursive: true });
  const db = new Database(STAGING_DB);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(SCHEMA_SQL, 'utf8'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS ingest_runs (
      source       TEXT NOT NULL,
      started_at   TEXT NOT NULL,
      finished_at  TEXT,
      rows         INTEGER,
      input_sha256 TEXT,
      PRIMARY KEY (source, started_at)
    );`);
  migrate(db);
  seedLanguages(db);
  return db;
}

/**
 * Idempotent column additions.
 *
 * schema.sql is all `CREATE TABLE IF NOT EXISTS`, so a table that already exists in someone's
 * staging.db never gains a column added to the file — a fresh clone would get it and this machine
 * would not, silently. Re-running `seed:all` from scratch is the documented remedy, but it costs
 * ~2.5 hours, which is too much to pay for one nullable column. These ALTERs bridge the gap and
 * are no-ops on a database built from the current schema.
 */
function migrate(db: DB): void {
  const has = (table: string, col: string): boolean =>
    (db.pragma(`table_info(${table})`) as { name: string }[]).some((c) => c.name === col);
  for (const [table, col, decl] of [
    ['daily_items', 'attribution', `TEXT NOT NULL DEFAULT ''`],
    ['daily_items', 'published_at', 'TEXT'],
    ['tech_terms', 'attribution', `TEXT NOT NULL DEFAULT ''`],
    ['tech_terms', 'wikidata_qid', 'TEXT'],
  ] as const) {
    if (!has(table, col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
  }
}

function seedLanguages(db: DB): void {
  const ins = db.prepare(`
    INSERT INTO languages (code, name_en, name_vi, name_native, script, level_scheme)
    VALUES (@code, @name_en, @name_vi, @name_native, @script, @level_scheme)
    ON CONFLICT(code) DO UPDATE SET
      name_en = excluded.name_en, name_vi = excluded.name_vi,
      name_native = excluded.name_native, script = excluded.script,
      level_scheme = excluded.level_scheme`);
  for (const l of [
    { code: 'en', name_en: 'English', name_vi: 'Tiếng Anh', name_native: 'English', script: 'latin', level_scheme: 'cefr' },
    { code: 'zh', name_en: 'Chinese (Mandarin)', name_vi: 'Tiếng Trung', name_native: '中文（普通话）', script: 'hanzi', level_scheme: 'hsk3' },
    { code: 'fr', name_en: 'French', name_vi: 'Tiếng Pháp', name_native: 'Français', script: 'latin', level_scheme: 'cefr' },
  ]) {
    ins.run(l);
  }
}

/** Upsert a row into `sources` — every ingest module must call this before inserting content. */
export function registerSource(db: DB, s: Source): void {
  db.prepare(`
    INSERT INTO sources (id, name, url, license, license_url, attribution_text, retrieved_at, license_mode)
    VALUES (@id, @name, @url, @license, @licenseUrl, @attributionText, @retrievedAt, @licenseMode)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, url = excluded.url, license = excluded.license,
      license_url = excluded.license_url, attribution_text = excluded.attribution_text,
      retrieved_at = excluded.retrieved_at, license_mode = excluded.license_mode
  `).run(s as unknown as Record<string, string>);
}

export function recordRun(db: DB, source: string, rows: number, inputSha?: string): void {
  db.prepare(`
    INSERT INTO ingest_runs (source, started_at, finished_at, rows, input_sha256)
    VALUES (?, ?, ?, ?, ?)`).run(source, new Date().toISOString(), new Date().toISOString(), rows, inputSha ?? null);
}

/** Skip work when the same input hash was already ingested successfully for this source. */
export function alreadyIngested(db: DB, source: string, inputSha: string): boolean {
  const row = db.prepare(`
    SELECT 1 AS hit FROM ingest_runs
    WHERE source = ? AND input_sha256 = ? AND finished_at IS NOT NULL
    LIMIT 1`).get(source, inputSha);
  return row !== undefined;
}
