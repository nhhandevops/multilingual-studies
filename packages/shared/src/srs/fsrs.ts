/**
 * ts-fsrs wrapper — the ONLY module that touches the FSRS algorithm.
 *
 * Pure by design: every function takes `now` explicitly (the web app passes its
 * debug-offset clock), and cards cross this boundary as plain serializable field
 * objects (ISO strings) that map 1:1 onto user.db `cards` columns — never ts-fsrs
 * class instances. Default parameters, no fuzz: scheduling is deterministic, which
 * v0.2's acceptance test (intervals advance under a clock offset) relies on.
 */
import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card,
  type Grade,
  type ReviewLog,
} from 'ts-fsrs';

export { Rating, State };
export type { Grade };

/** The four answer buttons, in display order. */
export const GRADES: readonly Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

/** FSRS scheduling fields exactly as stored in user.db `cards` (snake_case = column names). */
export interface SrsFields {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
}

/** review_log fields produced by a rating (everything except id/card_id/duration_ms). */
export interface SrsLogFields {
  rating: number;
  state: number;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  last_elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  review: string;
}

// Lazy so importing this module has no side effects (keeps it tree-shakeable
// from bundles that only need the schema constants, e.g. the sqlite worker).
let _engine: ReturnType<typeof fsrs> | null = null;
const engine = () => (_engine ??= fsrs()); // FSRS-6 default weights, retention 0.9, no fuzz

function toCard(f: SrsFields): Card {
  return {
    due: new Date(f.due),
    stability: f.stability,
    difficulty: f.difficulty,
    elapsed_days: f.elapsed_days,
    scheduled_days: f.scheduled_days,
    learning_steps: f.learning_steps,
    reps: f.reps,
    lapses: f.lapses,
    state: f.state as State,
    ...(f.last_review !== null ? { last_review: new Date(f.last_review) } : {}),
  };
}

function fromCard(c: Card): SrsFields {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review ? c.last_review.toISOString() : null,
  };
}

function fromLog(l: ReviewLog): SrsLogFields {
  return {
    rating: l.rating,
    state: l.state,
    due: l.due.toISOString(),
    stability: l.stability,
    difficulty: l.difficulty,
    elapsed_days: l.elapsed_days,
    last_elapsed_days: l.last_elapsed_days,
    scheduled_days: l.scheduled_days,
    learning_steps: l.learning_steps,
    review: l.review.toISOString(),
  };
}

/** Fields for a brand-new card (state New, due now). */
export function newSrsFields(now: Date): SrsFields {
  return fromCard(createEmptyCard(now));
}

/** Apply one rating. Returns the updated card fields and the review_log row to append. */
export function rate(f: SrsFields, grade: Grade, now: Date): { next: SrsFields; log: SrsLogFields } {
  const { card, log } = engine().next(toCard(f), now, grade);
  return { next: fromCard(card), log: fromLog(log) };
}

/** Minutes until due for each answer button — the UI renders these as interval hints. */
export function previewMinutes(f: SrsFields, now: Date): Record<Grade, number> {
  const preview = engine().repeat(toCard(f), now);
  const out = {} as Record<Grade, number>;
  for (const g of GRADES) {
    out[g] = Math.max(0, Math.round((preview[g].card.due.getTime() - now.getTime()) / 60_000));
  }
  return out;
}
