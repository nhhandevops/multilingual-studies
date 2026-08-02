/**
 * Zod contracts for all content rows. apps/ingest validates BEFORE insert;
 * apps/web trusts content.db (it was verified at pack build).
 */
import { z } from 'zod';

export const LangCode = z.enum(['en', 'zh', 'fr', 'ja']);
export type LangCode = z.infer<typeof LangCode>;

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** How a source's content may be used — enforced by `pack verify`. */
export const LicenseMode = z.enum([
  'bundled', //       full text/media may ship in the pack
  'verbatim-only', // may ship but must never be adapted/simplified (e.g. CC BY-ND)
  'link-only', //     only titles/URLs may ship; body must stay NULL (e.g. CC BY-NC-SA, all-rights-reserved)
]);
export type LicenseMode = z.infer<typeof LicenseMode>;

export const Source = z.object({
  id: z.string().min(1), //             'cedict', 'kaikki-en', 'tatoeba', ...
  name: z.string().min(1),
  url: z.string().url(),
  license: z.string().min(1), //        'CC BY-SA 4.0', 'public domain', ...
  licenseUrl: z.string().url().nullable(),
  attributionText: z.string().min(1), // rendered verbatim on the Licenses screen
  retrievedAt: z.string(),
  licenseMode: LicenseMode,
});
export type Source = z.infer<typeof Source>;

export const LevelScheme = z.enum(['cefr', 'hsk3']);
/** 'A1'..'C2' | 'HSK1'..'HSK6' | 'HSK7-9' */
export const Level = z.string().regex(/^(A1|A2|B1|B2|C1|C2|HSK[1-6]|HSK7-9)$/);
export type Level = z.infer<typeof Level>;

export const Word = z.object({
  id: z.string().min(1),
  lang: LangCode,
  headword: z.string().min(1),
  altForm: z.string().nullable(), //    zh: traditional form
  reading: z.string().nullable(), //    zh: tone-marked pinyin; en/fr: IPA
  freqRank: z.number().int().positive().nullable(),
  level: Level.nullable(),
  svCognate: z.string().nullable(), //  zh only: Sino-Vietnamese reading
  sourceId: z.string().min(1),
  extra: z.record(z.unknown()).nullable(),
});
export type Word = z.infer<typeof Word>;

export const Sense = z.object({
  // identity = (wordId, ord) — senses have no standalone ID (upstream senses aren't stable)
  wordId: z.string().min(1),
  ord: z.number().int().nonnegative(),
  pos: z.string().nullable(),
  glossEn: z.string().nullable(),
  glossVi: z.string().nullable(),
  examples: z.array(z.string()).nullable(),
  sourceId: z.string().min(1),
});
export type Sense = z.infer<typeof Sense>;

export const Sentence = z.object({
  id: z.string().min(1),
  lang: LangCode,
  text: z.string().min(1),
  transEn: z.string().nullable(),
  transVi: z.string().nullable(),
  reading: z.string().nullable(), //    zh: auto-pinyin (build-time)
  audioId: z.string().nullable(),
  levelEst: Level.nullable(),
  sourceId: z.string().min(1),
  attribution: z.string().nullable(), // e.g. 'sentence #123 by username, CC BY 2.0 FR'
});
export type Sentence = z.infer<typeof Sentence>;

export const GraphemeKind = z.enum(['letter', 'hanzi', 'pinyin_syllable', 'ipa_phone']);

export const Grapheme = z.object({
  id: z.string().min(1),
  lang: z.enum(['en', 'zh', 'fr', 'ja', 'all']),
  glyph: z.string().min(1),
  kind: GraphemeKind,
  reading: z.string().nullable(),
  ipa: z.string().nullable(),
  strokeJson: z.unknown().nullable(), // hanzi-writer data format ({strokes, medians}) for hanzi AND Latin
  diagramRef: z.string().nullable(), //  sagittal SVG asset path
  audioId: z.string().nullable(),
  ord: z.number().int().nullable(),
  notesMd: z.string().nullable(),
  sourceId: z.string().min(1),
});
export type Grapheme = z.infer<typeof Grapheme>;

export const GrammarTopic = z.object({
  id: z.string().min(1),
  lang: LangCode,
  code: z.string().nullable(), //       source-native code (HSK grammar point number…)
  titleEn: z.string().min(1),
  titleVi: z.string().nullable(),
  level: Level.nullable(),
  ord: z.number().int().nullable(),
  bodyMd: z.string().nullable(), //     MUST be null when source.licenseMode = 'link-only'
  externalLinks: z.array(z.object({ label: z.string(), url: z.string().url() })).nullable(),
  sourceId: z.string().min(1),
});
export type GrammarTopic = z.infer<typeof GrammarTopic>;

export const TechTerm = z.object({
  id: z.string().min(1),
  term: z.string().min(1),
  definition: z.string().min(1),
  domain: z.string().nullable(),
  sourceId: z.string().min(1),
});
export type TechTerm = z.infer<typeof TechTerm>;

export const DailyItemKind = z.enum(['news', 'wotd', 'tip-ref']);

export const DailyItem = z.object({
  id: z.string().min(1),
  lang: LangCode,
  date: IsoDate,
  kind: DailyItemKind,
  title: z.string().min(1),
  url: z.string().url().nullable(),
  bodyText: z.string().nullable(), //   null for link-only sources
  audioUrl: z.string().url().nullable(),
  levelEst: Level.nullable(),
  sourceId: z.string().min(1),
  curatedNote: z.string().nullable(), // Claude's one-liner, in Vietnamese
});
export type DailyItem = z.infer<typeof DailyItem>;

export const Tip = z.object({
  id: z.string().min(1),
  lang: z.enum(['en', 'zh', 'fr', 'ja', 'all']),
  dateAdded: IsoDate,
  title: z.string().min(1),
  bodyMd: z.string().min(1),
  technique: z.string().nullable(), //  'keyword-method' | 'tone-color' | 'gender-ending' | 'sv-cognate' | …
  links: z.array(z.object({ label: z.string(), url: z.string().url() })).nullable(),
  sourceId: z.string().nullable(),
});
export type Tip = z.infer<typeof Tip>;

export const AudioKind = z.enum(['word', 'sentence', 'syllable', 'phone']);

export const AudioRef = z.object({
  id: z.string().min(1),
  lang: z.enum(['en', 'zh', 'fr', 'ja', 'all']),
  kind: AudioKind,
  /** 'bundled:<relpath in pack assets>' | 'remote:<https url>' */
  location: z.string().regex(/^(bundled:|remote:https?:\/\/).+/),
  speaker: z.string().nullable(),
  license: z.string().min(1),
  attribution: z.string().min(1), //    NOT NULL — pack verify audits this
  sourceId: z.string().min(1),
});
export type AudioRef = z.infer<typeof AudioRef>;

export const PackManifest = z.object({
  packVersion: z.string().regex(/^\d{4}\.\d{2}\.\d{2}-\d+$/), // '2026.07.29-1'
  schemaVersion: z.number().int().positive(),
  minAppVersion: z.string(),
  dbSha256: z.string().length(64),
  dbBytes: z.number().int().positive(),
  counts: z.record(z.number().int().nonnegative()),
  /**
   * v0.9: the optional media pack (word-pronunciation blobs split out of the core pack).
   * Optional on purpose — pre-0.9 manifests parse in new code, and old clients ignore the key.
   * `bytes` is the DECOMPRESSED size (mirrors dbBytes); `file` is the published name (media.pack).
   */
  media: z
    .object({
      file: z.string().min(1),
      sha256: z.string().length(64),
      bytes: z.number().int().positive(),
      blobCount: z.number().int().nonnegative(),
    })
    .optional(),
});
export type PackManifest = z.infer<typeof PackManifest>;
