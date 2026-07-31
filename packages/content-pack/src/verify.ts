/**
 * Pack verifier — the compliance + integrity gate. Fails the build on:
 *  - sha256/manifest mismatch, integrity_check failure
 *  - attribution gaps (audio without attribution, rows without a registered source)
 *  - license_mode violations (link-only rows carrying body text; NC sources present at all)
 *  - ID churn: >0.5% of word IDs vanishing vs the previous pack without a rename entry
 */
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PackManifest } from '@mls/shared';

export interface VerifyIssue {
  level: 'error' | 'warn';
  check: string;
  detail: string;
}

export function verifyPack(packDir: string, packsDir?: string): VerifyIssue[] {
  const issues: VerifyIssue[] = [];
  const err = (check: string, detail: string) => issues.push({ level: 'error', check, detail });
  const warn = (check: string, detail: string) => issues.push({ level: 'warn', check, detail });

  const manifestPath = join(packDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    err('manifest', `missing ${manifestPath}`);
    return issues;
  }
  const manifest = PackManifest.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));

  const dbPath = join(packDir, 'content.db');
  if (!existsSync(dbPath)) {
    err('db', `missing ${dbPath}`);
    return issues;
  }
  const dbBytes = readFileSync(dbPath);
  const sha = createHash('sha256').update(dbBytes).digest('hex');
  if (sha !== manifest.dbSha256) err('sha256', `manifest ${manifest.dbSha256} != actual ${sha}`);
  if (dbBytes.length !== manifest.dbBytes) err('bytes', `manifest ${manifest.dbBytes} != actual ${dbBytes.length}`);

  const db = new Database(dbPath, { readonly: true });
  try {
    const integrity = db.pragma('integrity_check') as { integrity_check: string }[];
    if (integrity[0]?.integrity_check !== 'ok') err('integrity', JSON.stringify(integrity));

    const one = (sql: string): number => (db.prepare(sql).get() as { n: number }).n;

    // meta coherence
    const meta = Object.fromEntries(
      (db.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[]).map((r) => [r.key, r.value]),
    );
    if (meta['pack_version'] !== manifest.packVersion)
      err('meta', `meta.pack_version ${meta['pack_version']} != manifest ${manifest.packVersion}`);
    if (Number(meta['schema_version']) !== manifest.schemaVersion)
      err('meta', `meta.schema_version ${meta['schema_version']} != manifest ${manifest.schemaVersion}`);

    // every row references a registered source
    for (const [table, col] of [
      ['words', 'source_id'], ['senses', 'source_id'], ['sentences', 'source_id'],
      ['graphemes', 'source_id'], ['grammar_topics', 'source_id'], ['tech_terms', 'source_id'],
      ['daily_items', 'source_id'], ['audio', 'source_id'], ['hanzi_info', 'source_id'],
      ['asset_blobs', 'source_id'],
    ] as const) {
      const n = one(`SELECT COUNT(*) AS n FROM ${table} t
                     WHERE NOT EXISTS (SELECT 1 FROM sources s WHERE s.id = t.${col})`);
      if (n > 0) err('orphan-source', `${table}: ${n} rows with unregistered ${col}`);
    }

    // attribution audit
    const badAudio = one(`SELECT COUNT(*) AS n FROM audio WHERE attribution IS NULL OR attribution = '' OR license IS NULL OR license = ''`);
    if (badAudio > 0) err('attribution', `audio: ${badAudio} rows missing attribution/license`);
    const ncAudio = one(`SELECT COUNT(*) AS n FROM audio WHERE license LIKE '%NC%' OR license LIKE '%NonCommercial%' OR license LIKE '%ND%' OR license LIKE '%NoDeriv%'`);
    if (ncAudio > 0) err('license', `audio: ${ncAudio} NC/ND-licensed files must not be bundled`);

    // license_mode enforcement
    const linkOnlyGrammar = one(`SELECT COUNT(*) AS n FROM grammar_topics g
      JOIN sources s ON s.id = g.source_id
      WHERE s.license_mode = 'link-only' AND g.body_md IS NOT NULL`);
    if (linkOnlyGrammar > 0) err('license-mode', `grammar_topics: ${linkOnlyGrammar} link-only rows carry body_md`);
    const linkOnlyDaily = one(`SELECT COUNT(*) AS n FROM daily_items d
      JOIN sources s ON s.id = d.source_id
      WHERE s.license_mode = 'link-only' AND d.body_text IS NOT NULL`);
    if (linkOnlyDaily > 0) err('license-mode', `daily_items: ${linkOnlyDaily} link-only rows carry body_text`);
    const ncSources = (db.prepare(
      `SELECT id, license FROM sources WHERE license_mode != 'link-only' AND (license LIKE '%NC%' OR license LIKE '%NonCommercial%')`,
    ).all() as { id: string; license: string }[]);
    for (const s of ncSources) err('license', `source ${s.id} is NC (${s.license}) but not link-only`);

    // writing systems (v0.3) — the acceptance gate from docs/PLAN.md
    const strokeless = one(`SELECT COUNT(*) AS n FROM graphemes
      WHERE kind = 'hanzi' AND (stroke_json IS NULL OR stroke_json = '')`);
    if (strokeless > 0) err('strokes', `${strokeless} hanzi graphemes have no stroke_json`);
    const hsk1Missing = db.prepare(`
      WITH RECURSIVE chars(c, rest) AS (
        SELECT '', (SELECT group_concat(headword, '') FROM words WHERE lang = 'zh' AND level = 'HSK1')
        UNION ALL SELECT substr(rest, 1, 1), substr(rest, 2) FROM chars WHERE rest != ''
      )
      SELECT DISTINCT c FROM chars
       WHERE c != '' AND unicode(c) >= 19968 AND unicode(c) <= 40959
         AND c NOT IN (SELECT glyph FROM graphemes WHERE lang = 'zh' AND kind = 'hanzi')`)
      .all() as { c: string }[];
    if (hsk1Missing.length > 0)
      err('strokes', `${hsk1Missing.length} HSK1 characters lack stroke data: ${hsk1Missing.map((r) => r.c).join('')}`);
    const orphanInfo = one(`SELECT COUNT(*) AS n FROM hanzi_info i
      WHERE NOT EXISTS (SELECT 1 FROM graphemes g WHERE g.id = i.grapheme_id)`);
    if (orphanInfo > 0) err('hanzi-info', `${orphanInfo} hanzi_info rows reference a missing grapheme`);
    // Dangling media references render as a broken pane, so fail the build instead.
    const danglingAudio = one(`SELECT COUNT(*) AS n FROM graphemes g WHERE g.audio_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM audio_blobs b WHERE b.audio_id = g.audio_id)`);
    if (danglingAudio > 0) err('media', `${danglingAudio} graphemes point at audio with no blob`);
    const danglingDiagram = one(`SELECT COUNT(*) AS n FROM graphemes g WHERE g.diagram_ref IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM asset_blobs a WHERE a.id = g.diagram_ref)`);
    if (danglingDiagram > 0) err('media', `${danglingDiagram} graphemes point at a missing diagram asset`);
    // The Arphic PL requires redistributing its text; the app links /licenses/ARPHICPL.TXT.
    // packDir is <repo>/build/packs/<version>, so three levels up is the repo root.
    const aplSources = one(`SELECT COUNT(*) AS n FROM sources WHERE license LIKE '%Arphic%'`);
    if (aplSources > 0) {
      const repoRoot = join(packsDir ?? join(packDir, '..'), '..', '..');
      if (!existsSync(join(repoRoot, 'apps', 'web', 'public', 'licenses', 'ARPHICPL.TXT')))
        err('license', 'Arphic-licensed data is bundled but apps/web/public/licenses/ARPHICPL.TXT is missing');
    }

    // sentences (v0.4) — CC BY 2.0 FR requires crediting each contributor, so a sentence
    // without attribution is a licence violation, not a cosmetic gap.
    const unattributed = one(`SELECT COUNT(*) AS n FROM sentences WHERE attribution IS NULL OR attribution = ''`);
    if (unattributed > 0) err('attribution', `sentences: ${unattributed} rows missing per-sentence attribution`);
    const orphanLinks = one(`SELECT COUNT(*) AS n FROM word_sentences ws
      WHERE NOT EXISTS (SELECT 1 FROM sentences s WHERE s.id = ws.sentence_id)
         OR NOT EXISTS (SELECT 1 FROM words w WHERE w.id = ws.word_id)`);
    if (orphanLinks > 0) err('sentences', `${orphanLinks} word_sentences rows point at a missing word or sentence`);
    const untranslated = one(`SELECT COUNT(*) AS n FROM sentences WHERE lang != 'en' AND (trans_en IS NULL OR trans_en = '')`);
    if (untranslated > 0) warn('sentences', `${untranslated} non-English sentences have no English translation`);
    const zhNoReading = one(`SELECT COUNT(*) AS n FROM sentences WHERE lang = 'zh' AND (reading IS NULL OR reading = '')`);
    if (zhNoReading > 0) err('sentences', `${zhNoReading} zh sentences have no pinyin reading`);

    // FTS coverage
    const words = one('SELECT COUNT(*) AS n FROM words');
    const fts = one('SELECT COUNT(*) AS n FROM words_fts');
    if (fts !== words) err('fts', `words_fts rows ${fts} != words ${words}`);

    // ID churn vs previous pack
    if (packsDir) {
      const prev = findPreviousPack(packsDir, manifest.packVersion);
      if (prev) {
        const prevDb = new Database(join(packsDir, prev, 'content.db'), { readonly: true });
        try {
          const prevIds = new Set((prevDb.prepare('SELECT id FROM words').all() as { id: string }[]).map((r) => r.id));
          const curIds = new Set((db.prepare('SELECT id FROM words').all() as { id: string }[]).map((r) => r.id));
          let vanished = 0;
          for (const id of prevIds) if (!curIds.has(id)) vanished++;
          const pct = prevIds.size === 0 ? 0 : (vanished / prevIds.size) * 100;
          if (pct > 0.5) err('id-churn', `${vanished} word IDs (${pct.toFixed(2)}%) vanished vs pack ${prev}`);
          else if (vanished > 0) warn('id-churn', `${vanished} word IDs vanished vs pack ${prev} (${pct.toFixed(2)}% ≤ 0.5%)`);
        } finally {
          prevDb.close();
        }
      }
    }
  } finally {
    db.close();
  }
  return issues;
}

function findPreviousPack(packsDir: string, current: string): string | null {
  if (!existsSync(packsDir)) return null;
  const versions = readdirSync(packsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== current && existsSync(join(packsDir, d.name, 'content.db')))
    .map((d) => d.name)
    .sort((a, b) => {
      // '2026.07.29-2' < '2026.07.29-10': compare date part, then numeric suffix
      const [da = '', na = '0'] = a.split('-');
      const [db_ = '', nb = '0'] = b.split('-');
      return da === db_ ? Number(na) - Number(nb) : da.localeCompare(db_);
    });
  return versions.at(-1) ?? null;
}
