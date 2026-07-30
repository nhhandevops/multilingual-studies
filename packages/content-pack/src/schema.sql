-- content.db schema — schemaVersion 1 (tracked in meta; bump only with a migration note in docs/)
-- All primary keys are deterministic TEXT from packages/shared/src/ids.ts — NEVER autoincrement.
-- The same schema is used for build/staging.db (ingest adds its own ingest_runs table there).

PRAGMA journal_mode = WAL;

-- meta / provenance -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
); -- keys: schema_version, pack_version, min_app_version, built_at

CREATE TABLE IF NOT EXISTS languages (
  code         TEXT PRIMARY KEY,          -- 'en','zh','fr' ('ja' later: just a row)
  name_en      TEXT NOT NULL,
  name_vi      TEXT NOT NULL,
  name_native  TEXT NOT NULL,
  script       TEXT NOT NULL,             -- 'latin' | 'hanzi'
  level_scheme TEXT NOT NULL              -- 'cefr' | 'hsk3'
);

CREATE TABLE IF NOT EXISTS sources (
  id               TEXT PRIMARY KEY,      -- 'cedict','kaikki-en','tatoeba',...
  name             TEXT NOT NULL,
  url              TEXT NOT NULL,
  license          TEXT NOT NULL,
  license_url      TEXT,
  attribution_text TEXT NOT NULL,
  retrieved_at     TEXT NOT NULL,
  license_mode     TEXT NOT NULL CHECK (license_mode IN ('bundled','verbatim-only','link-only'))
);

-- lexicon ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS words (
  id         TEXT PRIMARY KEY,
  lang       TEXT NOT NULL REFERENCES languages(code),
  headword   TEXT NOT NULL,
  alt_form   TEXT,                        -- zh: traditional form
  reading    TEXT,                        -- zh: tone-marked pinyin; en/fr: IPA
  freq_rank  INTEGER,                     -- unified per-language rank
  level      TEXT,                        -- 'A1'..'C2' | 'HSK1'..'HSK7-9'
  sv_cognate TEXT,                        -- zh: Sino-Vietnamese reading ('đại học')
  source_id  TEXT NOT NULL REFERENCES sources(id),
  extra      TEXT                         -- JSON spillover, Zod-validated at ingest
) WITHOUT ROWID;                          -- clustered by id: no separate PK autoindex
CREATE INDEX IF NOT EXISTS idx_words_lang_headword ON words(lang, headword);
CREATE INDEX IF NOT EXISTS idx_words_headword      ON words(headword);
CREATE INDEX IF NOT EXISTS idx_words_lang_level    ON words(lang, level);
CREATE INDEX IF NOT EXISTS idx_words_lang_freq     ON words(lang, freq_rank);

CREATE TABLE IF NOT EXISTS senses (      -- identity = (word_id, ord); display-only, not SRS-keyed
  word_id   TEXT NOT NULL REFERENCES words(id),
  ord       INTEGER NOT NULL,
  pos       TEXT,
  gloss_en  TEXT,
  gloss_vi  TEXT,
  examples  TEXT,                         -- JSON array of strings
  source_id TEXT NOT NULL REFERENCES sources(id),
  PRIMARY KEY (word_id, ord)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS word_forms (   -- FR conjugations (kaikki "forms"), EN inflections
  word_id TEXT NOT NULL REFERENCES words(id),
  form    TEXT NOT NULL,
  tags    TEXT NOT NULL DEFAULT '[]',     -- JSON array: ["indicative","present","3s"]
  PRIMARY KEY (word_id, form, tags)
);

CREATE TABLE IF NOT EXISTS word_relations ( -- WordNet synonyms, hanzi decomposition links, …
  word_id    TEXT NOT NULL,
  related_id TEXT NOT NULL,
  rel        TEXT NOT NULL,               -- 'synonym','antonym','component','variant',…
  PRIMARY KEY (word_id, related_id, rel)
);

-- sentences -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sentences (
  id          TEXT PRIMARY KEY,
  lang        TEXT NOT NULL REFERENCES languages(code),
  text        TEXT NOT NULL,
  trans_en    TEXT,
  trans_vi    TEXT,
  reading     TEXT,                       -- zh: auto-pinyin at pack build
  audio_id    TEXT REFERENCES audio(id),
  level_est   TEXT,
  source_id   TEXT NOT NULL REFERENCES sources(id),
  attribution TEXT                        -- Tatoeba: 'sentence #123 by username, CC BY 2.0 FR'
);

CREATE TABLE IF NOT EXISTS word_sentences (
  word_id     TEXT NOT NULL REFERENCES words(id),
  sentence_id TEXT NOT NULL REFERENCES sentences(id),
  rank        INTEGER NOT NULL DEFAULT 0, -- 0 = best example for this word
  PRIMARY KEY (word_id, sentence_id)
);

-- writing systems -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS graphemes (
  id          TEXT PRIMARY KEY,
  lang        TEXT NOT NULL,              -- 'en','zh','fr' or 'all' (IPA chart)
  glyph       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('letter','hanzi','pinyin_syllable','ipa_phone')),
  reading     TEXT,
  ipa         TEXT,
  stroke_json TEXT,                       -- hanzi-writer format {strokes,medians}; also used for Latin
  diagram_ref TEXT,                       -- sagittal SVG path in pack assets
  audio_id    TEXT REFERENCES audio(id),
  ord         INTEGER,
  notes_md    TEXT,
  source_id   TEXT NOT NULL REFERENCES sources(id)
);
CREATE INDEX IF NOT EXISTS idx_graphemes_lang ON graphemes(lang, kind, ord);

-- Audio bytes live beside `audio` rather than in it: metadata is scanned constantly (pack
-- verify audits every row) while the blobs are only ever fetched one at a time by primary key.
-- Keeping them apart also means adding audio never rewrites the `audio` table's pages.
CREATE TABLE IF NOT EXISTS audio_blobs (
  audio_id TEXT PRIMARY KEY REFERENCES audio(id),
  bytes    BLOB NOT NULL
) WITHOUT ROWID;

-- makemeahanzi's dictionary.txt is LGPL-3.0-or-later while its graphics.txt is Arphic PL.
-- They live in separate tables on purpose: the LGPL half stays a separate, replaceable
-- component (see docs/RESEARCH-SOURCES.md) and `graphemes` keeps only bundle-clean data.
CREATE TABLE IF NOT EXISTS hanzi_info (
  grapheme_id   TEXT PRIMARY KEY REFERENCES graphemes(id),
  character     TEXT NOT NULL,
  definition    TEXT,
  pinyin        TEXT,                     -- JSON array, verbatim from upstream
  decomposition TEXT,                     -- IDS, e.g. '⿰女子'
  radical       TEXT,
  etymology     TEXT,                     -- JSON {type,hint,phonetic,semantic}
  source_id     TEXT NOT NULL REFERENCES sources(id)
);
CREATE INDEX IF NOT EXISTS idx_hanzi_info_radical ON hanzi_info(radical);

-- grammar / tips / tech / daily -------------------------------------------------
CREATE TABLE IF NOT EXISTS grammar_topics (
  id             TEXT PRIMARY KEY,
  lang           TEXT NOT NULL REFERENCES languages(code),
  code           TEXT,
  title_en       TEXT NOT NULL,
  title_vi       TEXT,
  level          TEXT,
  ord            INTEGER,
  body_md        TEXT,                    -- MUST be NULL when source is link-only (pack verify enforces)
  external_links TEXT,                    -- JSON [{label,url}]
  source_id      TEXT NOT NULL REFERENCES sources(id)
);
CREATE INDEX IF NOT EXISTS idx_grammar_lang ON grammar_topics(lang, level, ord);

CREATE TABLE IF NOT EXISTS tech_terms (
  id         TEXT PRIMARY KEY,
  term       TEXT NOT NULL,
  definition TEXT NOT NULL,
  domain     TEXT,
  source_id  TEXT NOT NULL REFERENCES sources(id)
);

CREATE TABLE IF NOT EXISTS tech_term_labels ( -- Wikidata CC0 labels/aliases
  term_id TEXT NOT NULL REFERENCES tech_terms(id),
  lang    TEXT NOT NULL,                  -- 'en','zh','fr','vi'
  label   TEXT NOT NULL,
  aliases TEXT,                           -- JSON array
  PRIMARY KEY (term_id, lang)
);

CREATE TABLE IF NOT EXISTS daily_items (
  id           TEXT PRIMARY KEY,
  lang         TEXT NOT NULL REFERENCES languages(code),
  date         TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('news','wotd','tip-ref')),
  title        TEXT NOT NULL,
  url          TEXT,
  body_text    TEXT,                      -- NULL for link-only sources (pack verify enforces)
  audio_url    TEXT,
  level_est    TEXT,
  source_id    TEXT NOT NULL REFERENCES sources(id),
  curated_note TEXT                       -- Claude's one-liner, in Vietnamese
);
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_items(date, lang);

CREATE TABLE IF NOT EXISTS daily_plan (   -- Claude's per-day curated new-word batch
  date    TEXT NOT NULL,
  lang    TEXT NOT NULL,
  word_id TEXT NOT NULL REFERENCES words(id),
  reason  TEXT,
  PRIMARY KEY (date, lang, word_id)
);

CREATE TABLE IF NOT EXISTS tips (
  id         TEXT PRIMARY KEY,
  lang       TEXT NOT NULL,               -- 'en','zh','fr' or 'all'
  date_added TEXT NOT NULL,
  title      TEXT NOT NULL,
  body_md    TEXT NOT NULL,
  technique  TEXT,                        -- 'keyword-method','tone-color','gender-ending','sv-cognate',…
  links      TEXT,                        -- JSON [{label,url}]
  source_id  TEXT REFERENCES sources(id)
);

-- audio -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audio (
  id          TEXT PRIMARY KEY,
  lang        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('word','sentence','syllable','phone')),
  location    TEXT NOT NULL,              -- 'bundled:<relpath>' | 'remote:<url>'
  speaker     TEXT,
  license     TEXT NOT NULL,
  attribution TEXT NOT NULL,              -- NOT NULL by design — audited at pack verify
  source_id   TEXT NOT NULL REFERENCES sources(id)
);

-- full-text search (rebuilt from scratch at pack build; not populated during ingest) --
-- Contentless (content='') + detail=none: stores only the token index + the UNINDEXED id column.
-- Token-presence search only (no phrase/NEAR/snippet); clear with the 'delete-all' command, not DELETE.
CREATE VIRTUAL TABLE IF NOT EXISTS words_fts USING fts5(
  word_id UNINDEXED,
  headword,
  alt_form,
  reading_plain,                          -- tone-stripped pinyin / plain reading for ascii search
  glosses,
  tokenize = 'unicode61 remove_diacritics 2',
  detail = 'none',
  content = '',
  contentless_unindexed = 1
);

CREATE VIRTUAL TABLE IF NOT EXISTS sentences_fts USING fts5(
  sentence_id UNINDEXED,
  text,
  trans_en,
  tokenize = 'unicode61 remove_diacritics 2',
  detail = 'none',
  content = '',
  contentless_unindexed = 1
);
