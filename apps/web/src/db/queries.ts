/** Typed query helpers over the worker RPC. All SQL against content.db lives here. */
import type { Db } from './provider';

export interface WordRow {
  id: string;
  lang: string;
  headword: string;
  alt_form: string | null;
  reading: string | null;
  freq_rank: number | null;
  level: string | null;
  sv_cognate: string | null;
  source_id: string;
}

export interface SenseRow {
  ord: number;
  pos: string | null;
  gloss_en: string | null;
  gloss_vi: string | null;
  examples: string | null;
}

export interface SourceRow {
  id: string;
  name: string;
  url: string;
  license: string;
  license_url: string | null;
  attribution_text: string;
  retrieved_at: string;
  license_mode: string;
}

const WORD_COLS = 'id, lang, headword, alt_form, reading, freq_rank, level, sv_cognate, source_id';

const hasCjk = (s: string) => /[㐀-鿿豈-﫿]/.test(s);

/** Build a safe FTS5 MATCH string: each term quoted, AND-joined (detail=none ⇒ no phrases). */
const ftsQuery = (input: string): string =>
  input
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replaceAll('"', '""')}"`)
    .join(' AND ');

export async function searchWords(db: Db, rawQuery: string, limit = 40): Promise<WordRow[]> {
  const q = rawQuery.trim();
  if (!q) return [];
  const seen = new Set<string>();
  const out: WordRow[] = [];
  const add = (rows: WordRow[]) => {
    for (const r of rows) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        out.push(r);
      }
    }
  };

  // 1. exact headword (all languages)
  add(await db.query<WordRow>(`SELECT ${WORD_COLS} FROM words WHERE headword = ? LIMIT ?`, [q, limit]));

  // 2. CJK substring (你好 contains 好); Latin prefix
  if (hasCjk(q)) {
    add(
      await db.query<WordRow>(
        `SELECT ${WORD_COLS} FROM words
         WHERE (headword LIKE ? OR alt_form LIKE ?) AND headword != ?
         ORDER BY length(headword) LIMIT ?`,
        [`%${q}%`, `%${q}%`, q, limit],
      ),
    );
  } else {
    add(
      await db.query<WordRow>(
        `SELECT ${WORD_COLS} FROM words WHERE headword LIKE ? AND headword != ? ORDER BY length(headword) LIMIT ?`,
        [`${q}%`, q, Math.min(limit, 15)],
      ),
    );
  }

  // 3. FTS over readings + glosses ("ni hao", "firmware", "bonjour")
  if (out.length < limit) {
    const match = ftsQuery(q);
    if (match) {
      add(
        await db.query<WordRow>(
          `SELECT ${WORD_COLS} FROM words WHERE id IN
             (SELECT word_id FROM words_fts WHERE words_fts MATCH ? LIMIT ?)
           ORDER BY freq_rank IS NULL, freq_rank LIMIT ?`,
          [match, limit, limit],
        ),
      );
    }
  }
  return out.slice(0, limit);
}

export async function getWord(db: Db, id: string): Promise<{ word: WordRow; senses: SenseRow[]; source: SourceRow } | null> {
  const words = await db.query<WordRow>(`SELECT ${WORD_COLS} FROM words WHERE id = ?`, [id]);
  const word = words[0];
  if (!word) return null;
  const senses = await db.query<SenseRow>(
    `SELECT ord, pos, gloss_en, gloss_vi, examples FROM senses WHERE word_id = ? ORDER BY ord`,
    [id],
  );
  const sources = await db.query<SourceRow>(`SELECT * FROM sources WHERE id = ?`, [word.source_id]);
  return { word, senses, source: sources[0]! };
}

export interface WordAudioRow {
  id: string; //           audio id, for playback
  speaker: string; //      the person who recorded it
  attribution: string; //  speaker + license — display it wherever the clip can be played
}

export interface ExampleRow {
  id: string;
  text: string;
  reading: string | null; //   zh: generated pinyin
  trans_en: string | null;
  attribution: string; //      CC BY 2.0 FR requires this — always display it
  rank: number;
}

/** Example sentences for a word, best first. */
export async function listExamples(db: Db, wordId: string, limit = 3): Promise<ExampleRow[]> {
  return db.query<ExampleRow>(
    `SELECT s.id, s.text, s.reading, s.trans_en, s.attribution, ws.rank
       FROM word_sentences ws JOIN sentences s ON s.id = ws.sentence_id
      WHERE ws.word_id = ? ORDER BY ws.rank LIMIT ?`,
    [wordId, limit],
  );
}

/**
 * The pronunciation clip for a word, if the pack has one.
 *
 * Review cards render from their snapshot (invariant 6), and this is a deliberate, narrow
 * exception: audio is *enrichment*, not card content. If the word vanished from a newer pack
 * the lookup simply returns null and the play button disappears — the card still reviews.
 * Storing megabytes of mp3 inside user.db to avoid this would be far worse.
 */
/**
 * The speaker and attribution come back with the id, not just the id: every bundled clip is
 * CC0/CC BY/CC BY-SA, and for the CC BY family naming the author is the licence's one real
 * condition. A single-speaker source could satisfy that with a line on the Licenses screen —
 * Lingua Libre cannot, since hundreds of different people recorded these.
 */
export async function getWordAudio(db: Db, wordId: string): Promise<WordAudioRow | null> {
  const rows = await db.query<WordAudioRow>(
    `SELECT a.id, a.speaker, a.attribution
       FROM word_audio wa JOIN audio a ON a.id = wa.audio_id
      WHERE wa.word_id = ? LIMIT 1`,
    [wordId],
  );
  return rows[0] ?? null;
}

export async function listSenses(db: Db, wordId: string): Promise<SenseRow[]> {
  return db.query<SenseRow>(
    `SELECT ord, pos, gloss_en, gloss_vi, examples FROM senses WHERE word_id = ? ORDER BY ord`,
    [wordId],
  );
}

export async function listLevels(db: Db, lang: string): Promise<{ level: string; n: number }[]> {
  return db.query(`SELECT level, COUNT(*) AS n FROM words WHERE lang = ? AND level IS NOT NULL GROUP BY level ORDER BY level`, [lang]);
}

export async function browseWords(
  db: Db,
  lang: string,
  level: string | null,
  offset = 0,
  limit = 50,
): Promise<WordRow[]> {
  if (level) {
    return db.query<WordRow>(
      `SELECT ${WORD_COLS} FROM words WHERE lang = ? AND level = ?
       ORDER BY freq_rank IS NULL, freq_rank, headword LIMIT ? OFFSET ?`,
      [lang, level, limit, offset],
    );
  }
  return db.query<WordRow>(
    `SELECT ${WORD_COLS} FROM words WHERE lang = ?
     ORDER BY freq_rank IS NULL, freq_rank, headword LIMIT ? OFFSET ?`,
    [lang, limit, offset],
  );
}

// --- writing systems (v0.3) -------------------------------------------------

export interface GraphemeRow {
  id: string;
  lang: string;
  glyph: string;
  kind: string;
  reading: string | null;
  ipa: string | null;
  stroke_json: string | null;
  ord: number | null;
  source_id: string;
}

/** makemeahanzi dictionary.txt data — LGPL, deliberately a separate table and a separate type. */
export interface HanziInfoRow {
  definition: string | null;
  pinyin: string | null; //        JSON array
  decomposition: string | null; // IDS, e.g. '⿰女子'
  radical: string | null;
  etymology: string | null; //     JSON {type,hint,phonetic,semantic}
}

const GRAPHEME_COLS = 'id, lang, glyph, kind, reading, ipa, stroke_json, ord, source_id';
// A character's HSK level = the level of its standalone word entry, when it has one.
const HANZI_LEVEL_SQL = `(SELECT MIN(w.level) FROM words w
   WHERE w.lang = 'zh' AND w.headword = g.glyph AND w.level IS NOT NULL)`;

export interface GraphemeDetail {
  grapheme: GraphemeRow;
  info: HanziInfoRow | null;
  /** Provenance of the stroke data (Arphic PL). */
  source: SourceRow;
  /** Provenance of `info` (LGPL) — a distinct row on purpose; null when there is no info. */
  infoSource: SourceRow | null;
}

export async function getGrapheme(db: Db, glyph: string): Promise<GraphemeDetail | null> {
  // Hanzi and Latin letters share the page; hanzi wins if a glyph somehow exists as both.
  const rows = await db.query<GraphemeRow>(
    `SELECT ${GRAPHEME_COLS} FROM graphemes
      WHERE kind IN ('hanzi', 'letter') AND glyph = ?
      ORDER BY CASE kind WHEN 'hanzi' THEN 0 ELSE 1 END LIMIT 1`,
    [glyph],
  );
  const grapheme = rows[0];
  if (!grapheme) return null;
  const info = await db.query<HanziInfoRow & { source_id: string }>(
    `SELECT definition, pinyin, decomposition, radical, etymology, source_id
       FROM hanzi_info WHERE grapheme_id = ?`,
    [grapheme.id],
  );
  const ids = [grapheme.source_id, ...(info[0] ? [info[0].source_id] : [])];
  const sources = await db.query<SourceRow>(
    `SELECT * FROM sources WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
  const byId = new Map(sources.map((s) => [s.id, s]));
  return {
    grapheme,
    info: info[0] ?? null,
    source: byId.get(grapheme.source_id)!,
    infoSource: info[0] ? byId.get(info[0].source_id) ?? null : null,
  };
}

export interface HanziListRow extends GraphemeRow {
  level: string | null;
}

/** Browse hanzi by HSK level (via their standalone word) or by stroke count. */
export async function browseHanzi(
  db: Db,
  filter: { level?: string; strokes?: number },
  offset = 0,
  limit = 60,
): Promise<HanziListRow[]> {
  if (filter.level) {
    return db.query<HanziListRow>(
      `SELECT ${GRAPHEME_COLS}, ${HANZI_LEVEL_SQL} AS level FROM graphemes g
        WHERE g.lang = 'zh' AND g.kind = 'hanzi' AND ${HANZI_LEVEL_SQL} = ?
        ORDER BY g.ord, g.glyph LIMIT ? OFFSET ?`,
      [filter.level, limit, offset],
    );
  }
  if (filter.strokes !== undefined) {
    return db.query<HanziListRow>(
      `SELECT ${GRAPHEME_COLS}, ${HANZI_LEVEL_SQL} AS level FROM graphemes g
        WHERE g.lang = 'zh' AND g.kind = 'hanzi' AND g.ord = ?
        ORDER BY g.glyph LIMIT ? OFFSET ?`,
      [filter.strokes, limit, offset],
    );
  }
  return db.query<HanziListRow>(
    `SELECT ${GRAPHEME_COLS}, ${HANZI_LEVEL_SQL} AS level FROM graphemes g
      WHERE g.lang = 'zh' AND g.kind = 'hanzi'
      ORDER BY g.ord, g.glyph LIMIT ? OFFSET ?`,
    [limit, offset],
  );
}

/** Which of these characters have stroke data — one query, for highlighting in word views. */
export async function haveStrokeData(db: Db, glyphs: string[]): Promise<Set<string>> {
  if (glyphs.length === 0) return new Set();
  const holes = glyphs.map(() => '?').join(',');
  const rows = await db.query<{ glyph: string }>(
    `SELECT glyph FROM graphemes WHERE kind IN ('hanzi', 'letter') AND glyph IN (${holes})`,
    glyphs,
  );
  return new Set(rows.map((r) => r.glyph));
}

/** Latin letters (a–z, A–Z, French accented forms) in teaching order. */
export async function browseLetters(db: Db): Promise<GraphemeRow[]> {
  return db.query<GraphemeRow>(
    `SELECT ${GRAPHEME_COLS} FROM graphemes WHERE kind = 'letter' ORDER BY ord`,
  );
}

/** Words containing this character, most common first — the "where do I meet it" list. */
export async function wordsWithChar(db: Db, glyph: string, limit = 20): Promise<WordRow[]> {
  return db.query<WordRow>(
    `SELECT ${WORD_COLS} FROM words
      WHERE lang = 'zh' AND headword LIKE ? AND freq_rank IS NOT NULL
      ORDER BY freq_rank LIMIT ?`,
    [`%${glyph}%`, limit],
  );
}

export interface SyllableRow {
  id: string;
  glyph: string; //    tone-marked, e.g. 'hǎo'
  reading: string; //  numbered, e.g. 'hao3' — the upstream key
  ord: number | null; //  tone 1-5
  audio_id: string | null;
}

/** The whole pinyin chart: 1,707 rows, small enough to load once and pivot in memory. */
export async function listPinyinSyllables(db: Db): Promise<SyllableRow[]> {
  return db.query<SyllableRow>(
    `SELECT id, glyph, reading, ord, audio_id FROM graphemes
      WHERE lang = 'zh' AND kind = 'pinyin_syllable' ORDER BY reading`,
  );
}

/** Audio bytes come back as a Uint8Array (SQLite BLOB) — kept out of the metadata queries. */
export async function getAudioBytes(db: Db, id: string): Promise<Uint8Array | null> {
  const rows = await db.query<{ bytes: Uint8Array }>(`SELECT bytes FROM audio_blobs WHERE audio_id = ?`, [id]);
  return rows[0]?.bytes ?? null;
}

export interface PhoneRow {
  id: string;
  glyph: string;
  ipa: string | null;
  diagram_ref: string | null;
  ord: number | null;
  notes_md: string | null; //  '<description> · <category>'
}

/** Language-neutral IPA phones with a sagittal diagram (lang='all'). */
export async function listIpaPhones(db: Db): Promise<PhoneRow[]> {
  return db.query<PhoneRow>(
    `SELECT id, glyph, ipa, diagram_ref, ord, notes_md FROM graphemes
      WHERE lang = 'all' AND kind = 'ipa_phone' ORDER BY ord`,
  );
}

/** SVG source for a diagram. Assets are text, so decode rather than making an object URL. */
export async function getAssetSvg(db: Db, id: string): Promise<string | null> {
  const rows = await db.query<{ bytes: Uint8Array; mime: string }>(
    `SELECT bytes, mime FROM asset_blobs WHERE id = ?`,
    [id],
  );
  const row = rows[0];
  if (!row || !row.mime.startsWith('image/svg')) return null;
  return new TextDecoder().decode(row.bytes);
}

export async function hanziStrokeCounts(db: Db): Promise<{ ord: number; n: number }[]> {
  return db.query(
    `SELECT ord, COUNT(*) AS n FROM graphemes
      WHERE lang = 'zh' AND kind = 'hanzi' AND ord IS NOT NULL GROUP BY ord ORDER BY ord`,
  );
}

export interface GrammarRow {
  id: string;
  lang: string;
  code: string | null;
  title_en: string;
  title_vi: string | null;
  level: string | null;
  ord: number | null;
  body_md: string | null;
  external_links: string | null; //  JSON [{label,url}]
  source_id: string;
  license_mode: string; //           'bundled' | 'verbatim-only' | 'link-only'
  source_name: string;
  source_url: string;
  license: string;
}

export interface GrammarLink {
  label: string;
  url: string;
}

/** Parse `external_links`; a malformed value must not take the page down. */
export function grammarLinks(row: { external_links: string | null }): GrammarLink[] {
  if (!row.external_links) return [];
  try {
    const v: unknown = JSON.parse(row.external_links);
    return Array.isArray(v) ? (v as GrammarLink[]).filter((l) => l && typeof l.url === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Grammar topics for a language, in the source's own teaching order.
 *
 * `license_mode` rides along because it changes what the UI may show: a link-only source has no
 * body to read in-app, and the reader has to say so rather than render a blank page.
 */
export async function listGrammar(db: Db, lang: string, level?: string): Promise<GrammarRow[]> {
  const where = level ? `AND g.level = ?` : '';
  return db.query<GrammarRow>(
    `SELECT g.*, s.license_mode, s.name AS source_name, s.url AS source_url, s.license
       FROM grammar_topics g JOIN sources s ON s.id = g.source_id
      WHERE g.lang = ? ${where}
      ORDER BY g.level IS NULL, g.level, g.ord, g.id`,
    level ? [lang, level] : [lang],
  );
}

export async function getGrammar(db: Db, id: string): Promise<GrammarRow | null> {
  const rows = await db.query<GrammarRow>(
    `SELECT g.*, s.license_mode, s.name AS source_name, s.url AS source_url, s.license
       FROM grammar_topics g JOIN sources s ON s.id = g.source_id
      WHERE g.id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

/** Which languages actually have grammar in this pack, and how many topics each. */
export async function grammarLangs(db: Db): Promise<{ lang: string; n: number }[]> {
  return db.query(`SELECT lang, COUNT(*) AS n FROM grammar_topics GROUP BY lang ORDER BY lang`);
}

export async function grammarLevels(db: Db, lang: string): Promise<{ level: string; n: number }[]> {
  return db.query(
    `SELECT level, COUNT(*) AS n FROM grammar_topics WHERE lang = ? AND level IS NOT NULL GROUP BY level ORDER BY level`,
    [lang],
  );
}

export async function listSources(db: Db): Promise<SourceRow[]> {
  return db.query<SourceRow>(`SELECT * FROM sources ORDER BY id`);
}

export async function packMeta(db: Db): Promise<Record<string, string>> {
  const rows = await db.query<{ key: string; value: string }>(`SELECT key, value FROM meta`);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
