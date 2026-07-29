/**
 * Stable content-ID derivation — THE contract that keeps SRS state alive across pack upgrades.
 *
 * Every content row's primary key is deterministic TEXT, never autoincrement:
 *   {lang}:{type}:{source}:{sourceKey}
 *
 * Rules (do not break without a `renames` migration entry):
 *  - This module is the ONLY place IDs are derived. apps/ingest and apps/web both import it.
 *  - Keys are NFC-normalized so 'é' composed/decomposed variants collide into one ID.
 *  - Changing any function here changes every derived ID → `pack verify` will fail the
 *    ID-diff check against the previous pack. That is the point.
 */

/** `all` = language-neutral graphemes (IPA chart); `tech` = IoT/professional module. */
export type IdLang = 'en' | 'zh' | 'fr' | 'ja' | 'all' | 'tech';

const norm = (s: string): string => s.normalize('NFC').trim();

/** Lowercase + collapse whitespace/punctuation to '-' for slug-shaped keys. */
export const slugify = (s: string): string =>
  norm(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

const assertNonEmpty = (part: string, what: string): string => {
  if (!part) throw new Error(`ids: empty ${what}`);
  if (part.includes(':')) throw new Error(`ids: ':' not allowed in ${what}: ${part}`);
  return part;
};

/**
 * Word ID. `key` is the headword as written in the source.
 * zh homographs: pass `disambig` = traditional form → `zh:w:cedict:干|乾`.
 * (CC-CEDICT distinguishes entries by simp+trad+pinyin; simp|trad is enough for our merge.)
 */
export function wordId(lang: IdLang, source: string, key: string, disambig?: string): string {
  const k = assertNonEmpty(norm(key), 'word key');
  const d = disambig ? `|${norm(disambig)}` : '';
  return `${lang}:w:${assertNonEmpty(source, 'source')}:${k}${d}`;
}

/** Sense IDs are word-relative and display-only (upstream senses have no stable native ID). */
export const senseId = (wordIdStr: string, ord: number): string => `${wordIdStr}:s${ord}`;

/** Sentence ID from the source's own permanent identifier (e.g. Tatoeba sentence number). */
export function sentenceId(lang: IdLang, source: string, nativeId: string | number): string {
  return `${lang}:snt:${assertNonEmpty(source, 'source')}:${assertNonEmpty(norm(String(nativeId)), 'sentence key')}`;
}

/** Grapheme ID keyed by the glyph itself: `zh:g:hw:好`, `fr:g:latin:é`, `all:g:ipa:θ`. */
export function graphemeId(lang: IdLang, source: string, glyph: string): string {
  return `${lang}:g:${assertNonEmpty(source, 'source')}:${assertNonEmpty(norm(glyph), 'glyph')}`;
}

/** Grammar topic ID from a source-native slug: `fr:gr:texs:pas-de-deux-03`. */
export function grammarId(lang: IdLang, source: string, slug: string): string {
  return `${lang}:gr:${assertNonEmpty(source, 'source')}:${assertNonEmpty(slugify(slug), 'grammar slug')}`;
}

/** Tech term ID: `tech:t:nist:access-control` (lang lives on the label rows, not the term). */
export function techTermId(source: string, key: string): string {
  return `tech:t:${assertNonEmpty(source, 'source')}:${assertNonEmpty(slugify(key), 'tech key')}`;
}

/** Daily item ID — date-scoped so re-running /daily-pull the same day replaces, never duplicates. */
export function dailyItemId(lang: IdLang, source: string, isoDate: string, slug: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error(`ids: bad date ${isoDate}`);
  return `${lang}:d:${assertNonEmpty(source, 'source')}:${isoDate}:${assertNonEmpty(slugify(slug), 'daily slug')}`;
}

/** Tip ID: `all:tip:2026-07-29:keyword-method` (lang-specific tips use their lang). */
export function tipId(lang: IdLang, isoDate: string, slug: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error(`ids: bad date ${isoDate}`);
  return `${lang}:tip:${isoDate}:${assertNonEmpty(slugify(slug), 'tip slug')}`;
}

/** Audio asset ID from source + source-relative path/filename. */
export function audioId(lang: IdLang, source: string, key: string): string {
  return `${lang}:a:${assertNonEmpty(source, 'source')}:${assertNonEmpty(norm(key), 'audio key')}`;
}

/** Parse any content ID back into its parts (best-effort; senses return their word ID). */
export function parseId(id: string): { lang: string; type: string; source?: string; key?: string } {
  const [lang, type, source, ...rest] = id.split(':');
  if (!lang || !type) throw new Error(`ids: unparseable ${id}`);
  const parsed: { lang: string; type: string; source?: string; key?: string } = { lang, type };
  if (source !== undefined) parsed.source = source;
  if (rest.length > 0) parsed.key = rest.join(':');
  return parsed;
}
