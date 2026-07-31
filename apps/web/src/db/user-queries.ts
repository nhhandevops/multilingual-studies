/**
 * All SQL against user.db lives here (queries.ts keeps the same contract for content.db).
 * Every scheduling mutation goes through db.userExec — one message = one transaction.
 */
import type { Db } from './provider';
import {
  listExamples,
  type GraphemeRow,
  type SenseRow,
  type TechLabelRow,
  type TechTermRow,
  type WordRow,
} from './queries';
import {
  DEFAULT_NEW_PER_DAY,
  newSrsFields,
  rate as fsrsRate,
  State,
  type CardSnapshot,
  type Grade,
  type UserCardRow,
} from '@mls/shared/srs';
import { localDateStr } from '../srs/clock';

export const CARD_COLS =
  'id, lang, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review, suspended, snapshot, added_at';

export type { UserCardRow };

// ---------------------------------------------------------------------------
// deck membership

export async function deckIds(db: Db, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db.userQuery<{ id: string }>(
    `SELECT id FROM cards WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
  return new Set(rows.map((r) => r.id));
}

export async function getCard(db: Db, id: string): Promise<UserCardRow | null> {
  const rows = await db.userQuery<UserCardRow>(`SELECT ${CARD_COLS} FROM cards WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

/** Freeze display fields into the card so it survives pack swaps (senses are NOT SRS-keyed). */
function buildSnapshot(
  word: WordRow,
  senses: SenseRow[],
  packVersion: string,
  example?: CardSnapshot['example'],
): CardSnapshot {
  return {
    headword: word.headword,
    altForm: word.alt_form,
    reading: word.reading,
    level: word.level,
    freqRank: word.freq_rank,
    senses: senses.slice(0, 4).map((s) => ({ pos: s.pos, glossEn: s.gloss_en, glossVi: s.gloss_vi })),
    packVersion,
    kind: 'word',
    ...(example ? { example } : {}),
    // The attested Sino-Vietnamese cognate rides the snapshot like every display field: the
    // review answer must render it without joining content.db (invariant 6).
    ...(word.sv_cognate ? { svCognate: word.sv_cognate } : {}),
  };
}

/**
 * Grapheme cards ride the same `cards` table and the same FSRS scheduler as word cards —
 * only the snapshot differs. `strokeJson` is frozen in for the same reason as every other
 * snapshot field: a review must never join content.db (see HANDOFF invariant 6).
 */
function buildGraphemeSnapshot(g: GraphemeRow, definition: string | null, packVersion: string): CardSnapshot {
  return {
    headword: g.glyph,
    altForm: null,
    reading: g.reading,
    level: null,
    freqRank: null,
    senses: definition ? [{ pos: null, glossEn: definition, glossVi: null }] : [],
    packVersion,
    kind: 'grapheme',
    ...(g.stroke_json ? { strokeJson: g.stroke_json } : {}),
  };
}

export async function addGraphemeCard(
  db: Db,
  grapheme: GraphemeRow,
  definition: string | null,
  packVersion: string,
  now: Date,
): Promise<void> {
  const f = newSrsFields(now);
  const snapshot = JSON.stringify(buildGraphemeSnapshot(grapheme, definition, packVersion));
  await db.userExec([
    {
      sql: `INSERT OR IGNORE INTO cards (${CARD_COLS})
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      params: [
        grapheme.id, grapheme.lang, f.due, f.stability, f.difficulty, f.elapsed_days, f.scheduled_days,
        f.learning_steps, f.reps, f.lapses, f.state, f.last_review, snapshot, now.toISOString(),
      ],
    },
  ]);
}

/**
 * Tech cards: same table, same scheduler, `lang='tech'` — its own deck with its own daily budget,
 * so drilling job vocabulary never eats the zh/en/fr new-card allowance. The prompt side shows
 * the English term; the answer side shows the definition and the zh/fr/vi labels, all frozen in.
 */
function buildTechSnapshot(
  term: TechTermRow,
  labels: TechLabelRow[],
  packVersion: string,
): CardSnapshot {
  const byLang = Object.fromEntries(labels.map((l) => [l.lang, l.label])) as Partial<
    Record<'zh' | 'fr' | 'vi', string>
  >;
  return {
    headword: term.term,
    altForm: null,
    reading: null,
    level: null,
    freqRank: null,
    senses: [{ pos: term.domain, glossEn: term.definition, glossVi: byLang.vi ?? null }],
    packVersion,
    kind: 'tech',
    labels: byLang,
  };
}

export async function addTechCard(
  db: Db,
  term: TechTermRow,
  labels: TechLabelRow[],
  packVersion: string,
  now: Date,
): Promise<void> {
  const f = newSrsFields(now);
  const snapshot = JSON.stringify(buildTechSnapshot(term, labels, packVersion));
  await db.userExec([
    {
      sql: `INSERT OR IGNORE INTO cards (${CARD_COLS})
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      params: [
        term.id, 'tech', f.due, f.stability, f.difficulty, f.elapsed_days, f.scheduled_days,
        f.learning_steps, f.reps, f.lapses, f.state, f.last_review, snapshot, now.toISOString(),
      ],
    },
  ]);
}

export async function addCard(
  db: Db,
  word: WordRow,
  senses: SenseRow[],
  packVersion: string,
  now: Date,
): Promise<void> {
  const f = newSrsFields(now);
  // Pull the best example NOW: a review renders from the snapshot alone, so joining
  // content.db later is not an option (invariant 6). No example is fine — it stays undefined.
  const [best] = await listExamples(db, word.id, 1);
  const example = best
    ? { text: best.text, reading: best.reading, transEn: best.trans_en, attribution: best.attribution }
    : undefined;
  const snapshot = JSON.stringify(buildSnapshot(word, senses, packVersion, example));
  await db.userExec([
    {
      sql: `INSERT OR IGNORE INTO cards (${CARD_COLS})
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      params: [
        word.id, word.lang, f.due, f.stability, f.difficulty, f.elapsed_days, f.scheduled_days,
        f.learning_steps, f.reps, f.lapses, f.state, f.last_review, snapshot, now.toISOString(),
      ],
    },
  ]);
}

/** Remove a card. review_log rows stay — the log is append-only (feeds the 1.4 optimizer). */
export async function removeCard(db: Db, id: string): Promise<void> {
  await db.userExec([{ sql: 'DELETE FROM cards WHERE id = ?', params: [id] }]);
}

// ---------------------------------------------------------------------------
// budgets & stats

export async function newPerDay(db: Db, lang: string): Promise<number> {
  const rows = await db.userQuery<{ value: string }>(`SELECT value FROM settings WHERE key = ?`, [
    `new_per_day.${lang}`,
  ]);
  const n = Number(rows[0]?.value);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_NEW_PER_DAY;
}

export async function setNewPerDay(db: Db, lang: string, n: number): Promise<void> {
  await db.userExec([
    {
      sql: `INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      params: [`new_per_day.${lang}`, String(n)],
    },
  ]);
}

export interface TodayStats {
  new_count: number;
  review_count: number;
  seconds: number;
}

export async function todayStats(db: Db, date: string): Promise<TodayStats> {
  const rows = await db.userQuery<TodayStats>(
    `SELECT COALESCE(SUM(new_count),0) AS new_count, COALESCE(SUM(review_count),0) AS review_count,
            COALESCE(SUM(seconds),0) AS seconds
     FROM daily_stats WHERE date = ?`,
    [date],
  );
  return rows[0] ?? { new_count: 0, review_count: 0, seconds: 0 };
}

/** Consecutive study days ending today (or yesterday, if today hasn't been studied yet). */
export async function streak(db: Db, now: Date): Promise<number> {
  // No LIMIT: one row per studied day stays tiny (10 years ≈ 3.7k), and the walk
  // below stops at the first gap anyway — a cap would only truncate long streaks.
  const rows = await db.userQuery<{ date: string }>(
    `SELECT DISTINCT date FROM daily_stats WHERE new_count + review_count > 0`,
  );
  const dates = new Set(rows.map((r) => r.date));
  let n = 0;
  const cursor = new Date(now);
  if (!dates.has(localDateStr(cursor))) cursor.setDate(cursor.getDate() - 1); // today not studied yet
  while (dates.has(localDateStr(cursor))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

// ---------------------------------------------------------------------------
// stats (v0.8)

export interface DeckCard {
  id: string;
  state: number; //  FSRS State: 0 new, 1 learning, 2 review, 3 relearning
}

/** Every card in one language's deck — ids + states only, for the dashboard's joins. */
export async function deckCards(db: Db, lang: string): Promise<DeckCard[]> {
  return db.userQuery<DeckCard>(`SELECT id, state FROM cards WHERE lang = ? AND suspended = 0`, [lang]);
}

/**
 * The learner's own measured pace: seconds per rated card, from their whole history.
 * Null until there is enough history to mean anything — the simulator falls back to a default
 * and SAYS it is a default, rather than presenting ten samples as a measurement.
 */
export async function measuredSecondsPerCard(db: Db): Promise<number | null> {
  const [row] = await db.userQuery<{ secs: number; n: number }>(
    `SELECT COALESCE(SUM(seconds),0) AS secs, COALESCE(SUM(new_count + review_count),0) AS n FROM daily_stats`,
  );
  if (!row || row.n < 50) return null;
  return row.secs / row.n;
}

// ---------------------------------------------------------------------------
// review queue

export interface LangQueueSummary {
  lang: string;
  dueCount: number;
  newAvailable: number; // min(new cards in deck, today's remaining budget)
  budget: number;
  newStudiedToday: number;
  totalCards: number;
}

export async function queueSummary(db: Db, langs: string[], now: Date): Promise<LangQueueSummary[]> {
  const date = localDateStr(now);
  const nowIso = now.toISOString();
  const out: LangQueueSummary[] = [];
  for (const lang of langs) {
    const [counts] = await db.userQuery<{ due: number; newCount: number; total: number }>(
      `SELECT
         SUM(CASE WHEN state != ${State.New} AND due <= ? THEN 1 ELSE 0 END) AS due,
         SUM(CASE WHEN state  = ${State.New} THEN 1 ELSE 0 END) AS newCount,
         COUNT(*) AS total
       FROM cards WHERE lang = ? AND suspended = 0`,
      [nowIso, lang],
    );
    const [stats] = await db.userQuery<{ n: number }>(
      `SELECT COALESCE(new_count, 0) AS n FROM daily_stats WHERE date = ? AND lang = ?`,
      [date, lang],
    );
    const budget = await newPerDay(db, lang);
    const newStudiedToday = stats?.n ?? 0;
    out.push({
      lang,
      dueCount: counts?.due ?? 0,
      newAvailable: Math.min(counts?.newCount ?? 0, Math.max(0, budget - newStudiedToday)),
      budget,
      newStudiedToday,
      totalCards: counts?.total ?? 0,
    });
  }
  return out;
}

/** Due reviews first (oldest due first), then new cards up to each language's remaining budget. */
export async function fetchQueue(db: Db, langs: string[], now: Date): Promise<UserCardRow[]> {
  const nowIso = now.toISOString();
  const summaries = await queueSummary(db, langs, now);
  const due = await db.userQuery<UserCardRow>(
    `SELECT ${CARD_COLS} FROM cards
     WHERE lang IN (${langs.map(() => '?').join(',')}) AND suspended = 0
       AND state != ${State.New} AND due <= ?
     ORDER BY due LIMIT 200`,
    [...langs, nowIso],
  );
  const fresh: UserCardRow[] = [];
  for (const s of summaries) {
    if (s.newAvailable <= 0) continue;
    const rows = await db.userQuery<UserCardRow>(
      `SELECT ${CARD_COLS} FROM cards
       WHERE lang = ? AND suspended = 0 AND state = ${State.New}
       ORDER BY added_at LIMIT ?`,
      [s.lang, s.newAvailable],
    );
    fresh.push(...rows);
  }
  return [...due, ...fresh];
}

// ---------------------------------------------------------------------------
// rating

/** Rate a card: card UPDATE + review_log INSERT + daily_stats UPSERT in one transaction. */
export async function rateCard(
  db: Db,
  card: UserCardRow,
  grade: Grade,
  now: Date,
  durationMs: number,
): Promise<UserCardRow> {
  const { next, log } = fsrsRate(card, grade, now);
  const wasNew = card.state === State.New;
  const date = localDateStr(now);
  // Cap per-card duration like Anki: an abandoned tab must not inflate study time.
  const duration = Math.min(Math.max(0, Math.round(durationMs)), 60_000);
  await db.userExec([
    {
      sql: `UPDATE cards SET due=?, stability=?, difficulty=?, elapsed_days=?, scheduled_days=?,
              learning_steps=?, reps=?, lapses=?, state=?, last_review=? WHERE id=?`,
      params: [
        next.due, next.stability, next.difficulty, next.elapsed_days, next.scheduled_days,
        next.learning_steps, next.reps, next.lapses, next.state, next.last_review, card.id,
      ],
    },
    {
      sql: `INSERT INTO review_log (card_id, rating, state, due, stability, difficulty, elapsed_days,
              last_elapsed_days, scheduled_days, learning_steps, review, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        card.id, log.rating, log.state, log.due, log.stability, log.difficulty, log.elapsed_days,
        log.last_elapsed_days, log.scheduled_days, log.learning_steps, log.review, duration,
      ],
    },
    {
      sql: `INSERT INTO daily_stats (date, lang, new_count, review_count, seconds)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(date, lang) DO UPDATE SET
              new_count = new_count + excluded.new_count,
              review_count = review_count + excluded.review_count,
              seconds = seconds + excluded.seconds`,
      params: [date, card.lang, wasNew ? 1 : 0, wasNew ? 0 : 1, duration / 1000],
    },
  ]);
  return { ...card, ...next };
}
