/**
 * Page-shape helpers for VOA's Pangea CMS, shared by `daily:voa-zh` and `seed:voa-le`.
 *
 * Both sites render an article body into `<div class="wsw">` with plain `<p>` children, and both
 * carry the publication date in a `<time pubdate datetime="…">`. Keeping the selectors in one
 * place means a CMS change breaks one file, not two — and the selectors are measured, not
 * guessed: `.wsw` is the exact container on both hosts, and its absence is the reliable signal
 * that a URL is a program/episode page (or one of VOA Learning English's 125 auto-generated
 * livestream stubs) rather than an article.
 */
import { decodeHtml } from './text';
import { htmlToText } from './feed';

/** The substring from `start` to the `</div>` that closes it, counting nesting. */
function balancedDiv(html: string, start: number): string {
  const re = /<div\b|<\/div\s*>/gi;
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[0].startsWith('</')) {
      depth--;
      if (depth === 0) return html.slice(start, m.index + m[0].length);
    } else depth++;
  }
  return html.slice(start);
}

export interface Article {
  /** Readable prose, glossary excluded. */
  body: string;
  /**
   * "Words in This Story" — the per-article glossary VOA Learning English appends.
   * It is the most useful part of the page for a learner and the least prose-like, so it is
   * separated rather than word-counted or levelled alongside the article.
   */
  glossary: string | null;
}

/**
 * Article prose from a Pangea page, or null when the page has no `.wsw` container.
 *
 * Null is a meaningful answer, not a failure: 34,537 of VOA Learning English's 67,274 sitemap URLs
 * are program pages with no article text at all, and the 2026 livestream stubs look like articles
 * until you look for this container.
 */
export function wswArticle(html: string): Article | null {
  const open = /<div[^>]*\bclass="[^"]*\bwsw\b[^"]*"[^>]*>/i.exec(html);
  if (!open) return null;
  let block = balancedDiv(html, open.index);

  // The first child is the audio player, not prose.
  block = block.replace(/<div[^>]*\bclass="[^"]*wsw__embed[^"]*"[\s\S]*?<\/div>/gi, '');

  // The glossary is delimited by its own heading. An underscore rule precedes it, but the
  // heading is the stable marker — the rule is just typography and its length varies.
  const split = /<h2[^>]*\bclass="[^"]*wsw__h2[^"]*"[^>]*>\s*(?:Words in This Story|Words in this Story)\s*<\/h2>/i.exec(block);
  const proseHtml = split ? block.slice(0, split.index) : block;
  const glossaryHtml = split ? block.slice(split.index + split[0].length) : null;

  const body = htmlToText(proseHtml)
    // the underscore rule that used to separate the glossary
    .replace(/^_{5,}$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const glossary = glossaryHtml
    ? htmlToText(glossaryHtml).replace(/^_{5,}$/gm, '').replace(/\n{3,}/g, '\n\n').trim()
    : null;
  return { body, glossary: glossary && glossary.length > 20 ? glossary : null };
}

/** ISO date from `<time pubdate datetime="2025-03-06T21:55:00+00:00">`. */
export function pubDate(html: string): string | null {
  const m = /<time[^>]*\bdatetime="([^"]+)"/i.exec(html);
  if (!m) return null;
  const raw = decodeHtml(m[1]!); //  the attribute arrives as `2025-03-06T21:55:00&#x2B;00:00`
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  const iso = new Date(ms).toISOString().slice(0, 10);
  // The livestream stubs render `January 01, 0001`. A year before the web existed is not a date.
  return iso.startsWith('0001') ? null : iso;
}

export function pageTitle(html: string): string | null {
  const m = /<h1[^>]*\bclass="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  return m ? decodeHtml(m[1]!.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() || null : null;
}

/** `<meta name="keywords">`, which carries the programme names an article belongs to. */
export function keywords(html: string): string[] {
  const m = /<meta[^>]*\bname="keywords"[^>]*\bcontent="([^"]*)"/i.exec(html)
    ?? /<meta[^>]*\bcontent="([^"]*)"[^>]*\bname="keywords"/i.exec(html);
  if (!m) return [];
  return decodeHtml(m[1]!).split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * MP3s referenced anywhere in the page.
 *
 * Deliberately a page-wide scan rather than a read of the `data-sources` audio manifest: that
 * manifest carries only the 128 kbps `_hq` file in both its `Src` and `AmpSrc` fields, while the
 * 64 kbps copy — identical speech at exactly half the bytes, measured 3,450,715 vs 6,901,386 —
 * appears elsewhere in the markup. Preferring the smaller file is the whole point.
 */
export function mp3Urls(html: string): string[] {
  const found = new Set<string>();
  const re = /https?:\/\/[^\s"'<>\\]+?\.mp3/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) found.add(decodeHtml(m[0]));
  return [...found];
}

/** The standard-quality clip when both exist — half the bytes, same speech. */
export function preferStandardQuality(urls: string[]): string | null {
  const plain = urls.filter((u) => !/_hq\.mp3$/i.test(u));
  return plain[0] ?? urls[0] ?? null;
}
