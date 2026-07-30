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
});
export type CardSnapshot = z.infer<typeof CardSnapshot>;

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
