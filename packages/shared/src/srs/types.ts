/**
 * Contracts for user.db rows. Zod-validated where data crosses a trust boundary
 * (the import button); plain types elsewhere — the app wrote the rows itself.
 */
import { z } from 'zod';

export const SnapshotSense = z.object({
  pos: z.string().nullable(),
  glossEn: z.string().nullable(),
  glossVi: z.string().nullable(),
});
export type SnapshotSense = z.infer<typeof SnapshotSense>;

/** An example sentence carried on a card. `attribution` is a CC BY licence obligation, not decoration. */
export const SnapshotExample = z.object({
  text: z.string(),
  reading: z.string().nullable(), //  zh pinyin
  transEn: z.string().nullable(),
  attribution: z.string(),
});
export type SnapshotExample = z.infer<typeof SnapshotExample>;

/**
 * Display fields frozen into the card at add-to-deck time. Cards key on word IDs, but a
 * word can legitimately vanish or change between packs (verify tolerates ≤0.5% churn) —
 * review must render from this snapshot, never by joining content.db.
 */
export const CardSnapshot = z.object({
  headword: z.string(),
  altForm: z.string().nullable(),
  reading: z.string().nullable(),
  level: z.string().nullable(),
  freqRank: z.number().int().nullable(),
  senses: z.array(SnapshotSense),
  packVersion: z.string(),
  // v0.3 additions — OPTIONAL so every card written by v0.2 still validates on import.
  // Absent `kind` means 'word': that is the only thing v0.2 could create.
  kind: z.enum(['word', 'grapheme']).optional(),
  /** Graphemes only: hanzi-writer `{strokes,medians}`, frozen in so review never joins content.db. */
  strokeJson: z.string().optional(),
  // v0.4 — one example sentence, frozen at add-time for the same reason as every other field
  // here: a review must render from the snapshot alone (invariant 6). Also optional.
  example: SnapshotExample.optional(),
});
export type CardSnapshot = z.infer<typeof CardSnapshot>;

/** Cards created before v0.3 carry no `kind`; they are all word cards. */
export const snapshotKind = (s: CardSnapshot): 'word' | 'grapheme' => s.kind ?? 'word';

/** cards row, column-for-column (snake_case = SQL column names). */
export interface UserCardRow {
  id: string;
  lang: string;
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
  suspended: number;
  snapshot: string;
  added_at: string;
}

/** daily_stats row. */
export interface DailyStatsRow {
  date: string;
  lang: string;
  new_count: number;
  review_count: number;
  seconds: number;
}
