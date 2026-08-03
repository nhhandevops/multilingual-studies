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

/**
 * Run a query against a table or column that a LATER pack version introduced.
 *
 * An installed pack can legitimately predate a feature: when the update is unreachable the worker
 * deliberately keeps what is installed rather than leaving the learner with nothing. SQLite
 * answers a query about a table that does not exist yet with "no such table", and that is a
 * missing feature, not a fault — the caller shows an empty state, exactly as `db.packTooOld` does
 * for the writing screens. Only those two messages are swallowed; every other SQL error still
 * propagates, so a real query bug cannot hide behind this.
 */
async function tolerant<T>(run: () => Promise<T[]>): Promise<T[]> {
  try {
    return await run();
  } catch (e) {
    if (/no such (table|column)/i.test(String(e))) return [];
    throw e;
  }
}

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
  // `word_audio` arrived in v0.4. An install still on a v0.3 pack threw here on every word page
  // and every review answer — three uncaught SQLITE_ERRORs per card — because a feature added
  // later assumed a table that older packs do not have.
  const rows = await tolerant<WordAudioRow>(() =>
    db.query<WordAudioRow>(
      `SELECT a.id, a.speaker, a.attribution
         FROM word_audio wa JOIN audio a ON a.id = wa.audio_id
        WHERE wa.word_id = ? LIMIT 1`,
      [wordId],
    ),
  );
  const row = rows[0];
  if (!row) return null;
  // v0.9: word-audio BLOBS live in the optional media pack while the metadata stays in the
  // core pack. Metadata without reachable bytes must present as "no recording" — the button
  // then honestly shows the labelled TTS voice instead of a recorded voice that cannot play.
  if (!(await db.audioHas(row.id))) return null;
  return row;
}

/**
 * Does the PACK claim a recording for this word, regardless of whether its bytes are
 * installed? True + getWordAudio()===null is exactly the "install the media pack to hear
 * this" case — the only place the media nudge is honest.
 */
export async function wordAudioInPack(db: Db, wordId: string): Promise<boolean> {
  const rows = await tolerant<{ n: number }>(() =>
    db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM word_audio WHERE word_id = ?`, [wordId]),
  );
  return (rows[0]?.n ?? 0) > 0;
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

/**
 * Audio bytes via the worker's dedicated RPC, which looks in the optional media pack first
 * and the core pack second (v0.9 split) — callers never know which file served the clip.
 */
export async function getAudioBytes(db: Db, id: string): Promise<Uint8Array | null> {
  return db.audioBytes(id);
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

// --- the daily pull (v0.6) --------------------------------------------------

export interface DailyItemRow {
  id: string;
  lang: string;
  date: string; //           the day this item is FOR
  kind: string;
  title: string;
  url: string | null;
  body_text: string | null;
  audio_url: string | null;
  level_est: string | null;
  source_id: string;
  curated_note: string | null; //  Claude's Vietnamese one-liner, when the pull was curated
  attribution: string; //          per-item credit — always render it
  published_at: string | null;
  source_name: string;
  source_url: string;
  license: string;
  license_mode: string;
}

const DAILY_COLS = `d.*, s.name AS source_name, s.url AS source_url, s.license, s.license_mode`;

/** Sources a daily pull writes. The rest of `daily_items` is the graded archive. */
const FRESH_SOURCES = `('voa-chinese', 'global-voices', 'wikipedia-itn')`;

/**
 * The most recent day this pack actually has news for, per language.
 *
 * The pack is built once and then read offline for as long as the learner goes without updating,
 * so "today's news" has to mean "the newest news this pack holds" — and the screen has to say
 * which day that is. Pretending a three-day-old pull is today's would be the dishonest version.
 */
export async function latestPullDate(db: Db, lang: string): Promise<string | null> {
  const rows = await db.query<{ date: string }>(
    `SELECT MAX(date) AS date FROM daily_items WHERE lang = ? AND source_id IN ${FRESH_SOURCES}`,
    [lang],
  );
  return rows[0]?.date ?? null;
}

export async function listDailyNews(db: Db, lang: string, date: string): Promise<DailyItemRow[]> {
  return db.query<DailyItemRow>(
    `SELECT ${DAILY_COLS} FROM daily_items d JOIN sources s ON s.id = d.source_id
      WHERE d.lang = ? AND d.date = ? AND d.source_id IN ${FRESH_SOURCES}
      ORDER BY d.source_id, d.id`,
    [lang, date],
  );
}

/**
 * Graded reading from the archive, newest first.
 *
 * Separate from the fresh pull on purpose: these are not today's news and must not be presented
 * as such. They are the levelled half of the Today screen — the part that works on any day.
 */
export async function listGradedReading(db: Db, lang: string, level?: string, limit = 12): Promise<DailyItemRow[]> {
  const where = level ? `AND d.level_est = ?` : '';
  return db.query<DailyItemRow>(
    `SELECT ${DAILY_COLS} FROM daily_items d JOIN sources s ON s.id = d.source_id
      WHERE d.lang = ? AND d.source_id NOT IN ${FRESH_SOURCES} ${where}
      ORDER BY d.date DESC, d.id LIMIT ?`,
    level ? [lang, level, limit] : [lang, limit],
  );
}

export async function gradedLevels(db: Db, lang: string): Promise<{ level: string; n: number }[]> {
  return db.query(
    `SELECT level_est AS level, COUNT(*) AS n FROM daily_items
      WHERE lang = ? AND level_est IS NOT NULL AND source_id NOT IN ${FRESH_SOURCES}
      GROUP BY level_est ORDER BY level_est`,
    [lang],
  );
}

export async function getDailyItem(db: Db, id: string): Promise<DailyItemRow | null> {
  const rows = await db.query<DailyItemRow>(
    `SELECT ${DAILY_COLS} FROM daily_items d JOIN sources s ON s.id = d.source_id WHERE d.id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

/** Which languages have any daily content at all. */
export async function dailyLangs(db: Db): Promise<{ lang: string; n: number }[]> {
  return db.query(`SELECT lang, COUNT(*) AS n FROM daily_items GROUP BY lang ORDER BY lang`);
}

export interface PlannedWord extends WordRow {
  /** Why this word, in Vietnamese — present only when a human/Claude curated the day. */
  reason: string | null;
}

/**
 * The day's new words. `date` is the plan's date, which may predate today for the same reason
 * the news does. Falls back to the newest plan the pack holds for this language.
 */
export async function dailyPlanWords(db: Db, lang: string, date: string | null): Promise<PlannedWord[]> {
  const on = date
    ? date
    : (await db.query<{ d: string }>(`SELECT MAX(date) AS d FROM daily_plan WHERE lang = ?`, [lang]))[0]?.d;
  if (!on) return [];
  return db.query<PlannedWord>(
    `SELECT ${WORD_COLS.split(', ').map((c) => `w.${c}`).join(', ')}, p.reason
       FROM daily_plan p JOIN words w ON w.id = p.word_id
      WHERE p.date = ? AND p.lang = ?
      ORDER BY w.level, w.freq_rank IS NULL, w.freq_rank`,
    [on, lang],
  );
}

export interface TipRow {
  id: string;
  lang: string;
  date_added: string;
  title: string;
  body_md: string;
  technique: string | null;
  links: string | null;
  source_id: string;
}

/**
 * One tip for the day: the tip written for that date if there is one, else a deterministic pick
 * from the evergreen set.
 *
 * Deterministic, not random: the same day must show the same tip on every reload and on every
 * device, or "today's tip" is just a shuffle button.
 */
export async function tipOfDay(db: Db, lang: string, isoDate: string): Promise<TipRow | null> {
  const dated = await db.query<TipRow>(
    `SELECT * FROM tips WHERE date_added = ? AND lang IN (?, 'all') ORDER BY lang = 'all', id LIMIT 1`,
    [isoDate, lang],
  );
  if (dated[0]) return dated[0];
  const pool = await db.query<TipRow>(`SELECT * FROM tips WHERE lang IN (?, 'all') ORDER BY id`, [lang]);
  if (pool.length === 0) return null;
  const days = Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000);
  return pool[((days % pool.length) + pool.length) % pool.length]!;
}

export function tipLinks(row: { links: string | null }): GrammarLink[] {
  if (!row.links) return [];
  try {
    const v: unknown = JSON.parse(row.links);
    return Array.isArray(v) ? (v as GrammarLink[]).filter((l) => l && typeof l.url === 'string') : [];
  } catch {
    return [];
  }
}

// --- tech vocabulary (v0.7) -------------------------------------------------

export interface TechTermRow {
  id: string;
  term: string;
  definition: string;
  domain: string | null;
  source_id: string;
  attribution: string; //      per-term credit — always render it
  wikidata_qid: string | null;
  source_name: string;
  source_url: string;
  license: string;
}

export interface TechLabelRow {
  lang: string; //     'zh' | 'fr' | 'vi'
  label: string;
  aliases: string | null; //  JSON array
}

/**
 * Terms with their labels in one round trip.
 *
 * The join is deliberately LEFT: a term whose Wikidata item lacks a Vietnamese label is still a
 * term worth showing — the gap is displayed as a gap, not used to hide the row. (Both tables ship
 * in the same pack, but `tolerant` still wraps the queries: an installed pack can predate v0.7,
 * exactly the situation that threw `no such table: word_audio` for three versions.)
 */
export async function listTechTerms(db: Db, domain?: string): Promise<(TechTermRow & { labels: TechLabelRow[] })[]> {
  const where = domain ? `WHERE t.domain = ?` : '';
  const terms = await tolerant<TechTermRow>(() =>
    db.query<TechTermRow>(
      `SELECT t.*, s.name AS source_name, s.url AS source_url, s.license
         FROM tech_terms t JOIN sources s ON s.id = t.source_id ${where}
        ORDER BY t.term`,
      domain ? [domain] : [],
    ),
  );
  if (terms.length === 0) return [];
  const labels = await tolerant<TechLabelRow & { term_id: string }>(() =>
    db.query<TechLabelRow & { term_id: string }>(
      `SELECT term_id, lang, label, aliases FROM tech_term_labels ORDER BY term_id, lang`,
    ),
  );
  const byTerm = new Map<string, TechLabelRow[]>();
  for (const l of labels) {
    const list = byTerm.get(l.term_id) ?? [];
    list.push(l);
    byTerm.set(l.term_id, list);
  }
  return terms.map((t) => ({ ...t, labels: byTerm.get(t.id) ?? [] }));
}

export async function getTechTerm(db: Db, id: string): Promise<(TechTermRow & { labels: TechLabelRow[] }) | null> {
  const rows = await tolerant<TechTermRow>(() =>
    db.query<TechTermRow>(
      `SELECT t.*, s.name AS source_name, s.url AS source_url, s.license
         FROM tech_terms t JOIN sources s ON s.id = t.source_id WHERE t.id = ?`,
      [id],
    ),
  );
  const term = rows[0];
  if (!term) return null;
  const labels = await tolerant<TechLabelRow>(() =>
    db.query<TechLabelRow>(`SELECT lang, label, aliases FROM tech_term_labels WHERE term_id = ? ORDER BY lang`, [id]),
  );
  return { ...term, labels };
}

export async function techDomains(db: Db): Promise<{ domain: string; n: number }[]> {
  return tolerant(() =>
    db.query(`SELECT domain, COUNT(*) AS n FROM tech_terms WHERE domain IS NOT NULL GROUP BY domain ORDER BY domain`),
  );
}

/** Parse a label row's aliases; malformed JSON must not take the page down. */
export function labelAliases(row: { aliases: string | null }): string[] {
  if (!row.aliases) return [];
  try {
    const v: unknown = JSON.parse(row.aliases);
    return Array.isArray(v) ? v.filter((a): a is string => typeof a === 'string') : [];
  } catch {
    return [];
  }
}

// --- stats (v0.8) -----------------------------------------------------------

/**
 * Level of each given word id, from the CURRENT pack — the dashboard's join between the deck
 * (user.db ids) and the level tables. Words that vanished from the pack simply do not come
 * back, which the dashboard shows as "other" rather than losing them.
 */
export async function levelsOf(db: Db, ids: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500);
    const rows = await db.query<{ id: string; level: string | null }>(
      `SELECT id, level FROM words WHERE id IN (${batch.map(() => '?').join(',')})`,
      batch,
    );
    for (const r of rows) out.set(r.id, r.level);
  }
  return out;
}

export async function listSources(db: Db): Promise<SourceRow[]> {
  return db.query<SourceRow>(`SELECT * FROM sources ORDER BY id`);
}

export async function packMeta(db: Db): Promise<Record<string, string>> {
  const rows = await db.query<{ key: string; value: string }>(`SELECT key, value FROM meta`);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
