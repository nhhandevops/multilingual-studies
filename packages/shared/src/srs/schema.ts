/**
 * user.db — the learner's private, per-device database. NEVER inside the content pack,
 * never in git; the only irreplaceable data (one-button export/import in the web app).
 *
 * Migrations are append-only: to change the schema, push a new SQL batch onto
 * USER_MIGRATIONS — the runner applies batches beyond `PRAGMA user_version` and stamps
 * the new version, and USER_SCHEMA_VERSION derives from the array length automatically.
 * Never edit a shipped batch; existing user.db files have already run it.
 */

export const USER_MIGRATIONS: readonly string[] = [
  // v1 — cards / review_log / settings / daily_stats (docs/PLAN.md "user.db")
  `
  CREATE TABLE cards (
    id             TEXT PRIMARY KEY,   -- content word ID (packages/shared/src/ids.ts) — the stable-ID contract
    lang           TEXT NOT NULL,
    due            TEXT NOT NULL,      -- ISO-8601 UTC
    stability      REAL NOT NULL,
    difficulty     REAL NOT NULL,
    elapsed_days   REAL NOT NULL,
    scheduled_days REAL NOT NULL,
    learning_steps INTEGER NOT NULL,
    reps           INTEGER NOT NULL,
    lapses         INTEGER NOT NULL,
    state          INTEGER NOT NULL,   -- ts-fsrs State: 0 New · 1 Learning · 2 Review · 3 Relearning
    last_review    TEXT,
    suspended      INTEGER NOT NULL DEFAULT 0,
    snapshot       TEXT NOT NULL,      -- JSON CardSnapshot: display fields survive pack swaps/removals
    added_at       TEXT NOT NULL
  ) WITHOUT ROWID;
  CREATE INDEX cards_by_due  ON cards(suspended, state, due);
  CREATE INDEX cards_by_lang ON cards(lang, suspended, state, due);

  -- Append-only, py-fsrs-optimizer-shaped (feeds FSRS personalization in v1.4).
  -- Rows are never deleted, even when their card is removed.
  CREATE TABLE review_log (
    id                INTEGER PRIMARY KEY,
    card_id           TEXT NOT NULL,
    rating            INTEGER NOT NULL, -- 1 Again · 2 Hard · 3 Good · 4 Easy
    state             INTEGER NOT NULL, -- card state BEFORE this review
    due               TEXT NOT NULL,    -- card due BEFORE this review
    stability         REAL NOT NULL,
    difficulty        REAL NOT NULL,
    elapsed_days      REAL NOT NULL,
    last_elapsed_days REAL NOT NULL,
    scheduled_days    REAL NOT NULL,
    learning_steps    INTEGER NOT NULL,
    review            TEXT NOT NULL,    -- ISO-8601 UTC time of the review
    duration_ms       INTEGER
  );
  CREATE INDEX review_log_by_card ON review_log(card_id, review);

  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,             -- e.g. 'new_per_day.zh'
    value TEXT NOT NULL
  ) WITHOUT ROWID;

  CREATE TABLE daily_stats (
    date         TEXT NOT NULL,         -- local YYYY-MM-DD (device timezone)
    lang         TEXT NOT NULL,
    new_count    INTEGER NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    seconds      REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (date, lang)
  ) WITHOUT ROWID;
  `,
];

/** Derived, never hand-maintained — appending a migration bumps it automatically. */
export const USER_SCHEMA_VERSION = USER_MIGRATIONS.length;

export const DEFAULT_NEW_PER_DAY = 5;
