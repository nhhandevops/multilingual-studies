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

export async function listSources(db: Db): Promise<SourceRow[]> {
  return db.query<SourceRow>(`SELECT * FROM sources ORDER BY id`);
}

export async function packMeta(db: Db): Promise<Record<string, string>> {
  const rows = await db.query<{ key: string; value: string }>(`SELECT key, value FROM meta`);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
