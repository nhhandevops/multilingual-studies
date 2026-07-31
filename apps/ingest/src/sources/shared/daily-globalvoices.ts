/**
 * daily:globalvoices — fresh English and French articles from Global Voices (CC BY 3.0).
 *
 * WHY THIS SOURCE. VOA's English service and VOA Afrique have both been frozen since March 2025,
 * and the vetted alternatives fail on licence: The Conversation is CC BY-ND (no excerpting, and
 * they ask republishers to embed a tracking pixel — which an app that verifies "0 off-origin
 * requests" in every acceptance run cannot do), RFI's terms forbid storage outright, and UN News
 * grants personal use only. Global Voices is CC BY: cacheable, bundleable, and adaptable.
 *
 * TWO FINDINGS SHAPED THIS MODULE, both measured rather than assumed:
 *
 *  1. `<dc:creator>` IS THE WRONG NAME. On the French feed it is the TRANSLATOR on 10 items out of
 *     10 — never the author — and the same trap fires on the English feed for syndicated pieces.
 *     Crediting the translator as the author is precisely the failure v0.4 found in the French
 *     audio, where a licence field was filled from the wrong place and 68% of rows asserted
 *     something untrue. The real credit is in the body: a `gv-rss-footer` block whose
 *     `credit-label` spans distinguish "Written by" from "Traduit (Français) par". This module
 *     parses that block and stores both names.
 *
 *  2. THE FEED CARRIES NO LICENCE. The English channel says "Creative Commons Attribution, see
 *     our Attribution Policy" in prose with no URL; the French feed says nothing at all. The
 *     machine-checkable `rel="license"` lives on the ARTICLE page. Per the project rule to verify
 *     a licence per file wherever the source permits it, each stored item's page is fetched and
 *     its licence read — and read only from the article's own credit container, because the pages
 *     also contain third-party image licences (CC BY-SA 3.0 on a Wikimedia photo) and a malformed
 *     ccREL URL with a doubled slash. Grabbing the first `creativecommons.org` match on the page
 *     records a licence the article does not have.
 */
import { parseFeed, htmlToText, textLength } from '../../lib/feed';
import { polite } from '../../lib/politeness';
import { writeDailyItems, type DailyItem } from '../../lib/daily';
import { levelEstimator } from '../../lib/level';
import { decodeHtml } from '../../lib/text';
import { registerSource, recordRun, type DB } from '../../lib/staging';

const SOURCE_ID = 'global-voices';
const FEEDS: { lang: 'en' | 'fr'; url: string; site: string }[] = [
  { lang: 'en', url: 'https://globalvoices.org/feed/', site: 'https://globalvoices.org/' },
  { lang: 'fr', url: 'https://fr.globalvoices.org/feed/', site: 'https://fr.globalvoices.org/' },
];

const MAX_PER_LANG = 5;
const MIN_BODY_CHARS = 400;
/** The only licence we accept for bundling. Anything else is a change we must look at, not absorb. */
const REQUIRED_LICENSE = 'creativecommons.org/licenses/by/3.0';

export interface DailyResult {
  source: string;
  lang: string;
  stored: number;
  skipped: { url: string; why: string }[];
}

export async function run(db: DB, opts: { date: string }): Promise<DailyResult[]> {
  const results: DailyResult[] = [];
  for (const feed of FEEDS) {
    results.push(await runOne(db, feed, opts.date));
  }
  return results;
}

async function runOne(
  db: DB,
  feed: { lang: 'en' | 'fr'; url: string; site: string },
  date: string,
): Promise<DailyResult> {
  const skipped: { url: string; why: string }[] = [];
  const estimate = levelEstimator(db, feed.lang);

  const res = await polite(feed.url, { headers: { accept: 'application/rss+xml, application/xml' } });
  if (!res.ok) throw new Error(`globalvoices ${feed.lang}: feed HTTP ${res.status}`);
  const items = parseFeed(await res.text());
  if (items.length === 0) throw new Error(`globalvoices ${feed.lang}: feed parsed to 0 items`);
  console.log(`  feed ${feed.lang}: ${items.length} items, newest ${items[0]?.publishedRaw ?? '?'}`);

  const out: DailyItem[] = [];
  for (const item of items) {
    if (out.length >= MAX_PER_LANG) break;
    if (!item.contentHtml || !item.link) {
      skipped.push({ url: item.link || item.title, why: 'no content:encoded' });
      continue;
    }
    const credits = parseCredits(item.contentHtml);
    if (credits.author === null) {
      // Without a name there is no way to satisfy CC BY, so the item cannot be bundled at all.
      skipped.push({ url: item.link, why: 'no author credit in gv-rss-footer' });
      continue;
    }

    const license = await verifyLicense(item.link);
    if (license === null) {
      skipped.push({ url: item.link, why: 'article page states no CC BY 3.0 licence' });
      continue;
    }

    const body = cleanBody(item.contentHtml);
    if (textLength(body) < MIN_BODY_CHARS) {
      skipped.push({ url: item.link, why: `body too short (${textLength(body)} chars)` });
      continue;
    }

    const translated = credits.translator ? `, translated by ${credits.translator.name}` : '';
    out.push({
      lang: feed.lang,
      date,
      kind: 'news',
      slug: slugOf(item.link),
      title: item.title,
      url: item.link,
      bodyText: body,
      audioUrl: null,
      levelEst: estimate(body)?.level ?? null,
      attribution: `${credits.author.name} — Global Voices${translated} (${license})`,
      publishedAt: item.published,
    });
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'Global Voices',
    url: 'https://globalvoices.org/',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    attributionText:
      'Articles from Global Voices (globalvoices.org and fr.globalvoices.org), licensed CC BY 3.0. Their republishing guidelines require the author’s name and a link to the original story, so both are stored per article and always displayed. The author is read from each article’s own credit block, not from the feed’s dc:creator field — on the French feed that field names the translator, not the writer. Images are not bundled: many are third-party works under their own licences.',
    retrievedAt: date,
    licenseMode: 'bundled',
  });

  const stored = writeDailyItems(db, SOURCE_ID, feed.lang, date, out);
  recordRun(db, SOURCE_ID, stored);
  console.log(`  ✓ globalvoices ${feed.lang}: ${stored} items for ${date}${skipped.length ? ` (${skipped.length} skipped)` : ''}`);
  for (const s of skipped) console.log(`    – ${s.why}`);
  return { source: SOURCE_ID, lang: feed.lang, stored, skipped };
}

interface Credit {
  label: string;
  name: string;
  url: string;
}

/**
 * The credit block at the tail of every `content:encoded`.
 *
 * Shape (single-quoted attributes, as WordPress emits them):
 *   <div class='gv-rss-footer'>…<div class='text-credits-section'>
 *     <span class='credit-label'>Written (English) by</span>
 *     <a href='…/author/jo-carter/' class='user-link'>Jo Carter</a>
 *   </div>…
 * The first section is the writer; a "Traduit"/"Translated" section names the translator.
 */
export function parseCredits(contentHtml: string): { author: Credit | null; translator: Credit | null } {
  const footer = /<div class=['"]gv-rss-footer['"][\s\S]*$/i.exec(contentHtml);
  if (!footer) return { author: null, translator: null };
  const credits: Credit[] = [];
  const re = /<span class=['"]credit-label['"]>([\s\S]*?)<\/span>\s*<a href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
  for (let m = re.exec(footer[0]); m; m = re.exec(footer[0])) {
    credits.push({
      label: decodeHtml(m[1]!.replace(/<[^>]+>/g, '')).trim(),
      url: decodeHtml(m[2]!),
      name: decodeHtml(m[3]!.replace(/<[^>]+>/g, '')).trim(),
    });
  }
  const isTranslation = (c: Credit) => /traduit|translated|traducido|traduzido/i.test(c.label);
  return {
    author: credits.find((c) => !isTranslation(c)) ?? null,
    translator: credits.find(isTranslation) ?? null,
  };
}

/** Article body with the syndication furniture removed — it is metadata, not the piece. */
export function cleanBody(contentHtml: string): string {
  const stripped = contentHtml
    .replace(/<div class=['"]gv-rss-footer['"][\s\S]*$/i, '')
    .replace(/<p class=['"]originally-published['"][\s\S]*?<\/p>/gi, '')
    .replace(/<div[^>]*class=['"][^'"]*wp-caption[^'"]*['"][\s\S]*?<\/div>/gi, '');
  return htmlToText(stripped);
}

/**
 * The article's OWN licence, or null.
 *
 * Read only from `div.post-credit-container`. The rest of the page carries other CC URLs — image
 * credits (`creativecommons.org/licenses/by-sa/3.0` on a Wikimedia photo) and an RDF block whose
 * URL is `http://creativecommons.org/licenses/by/3.0//` with a doubled slash — so a page-wide
 * regex records a licence that belongs to somebody else's photograph.
 */
export async function verifyLicense(url: string): Promise<string | null> {
  const res = await polite(url, { headers: { accept: 'text/html' } });
  if (!res.ok) return null;
  const html = await res.text();
  const container = /<div[^>]*class=['"][^'"]*post-credit-container[^'"]*['"][\s\S]{0,1200}/i.exec(html);
  if (!container) return null;
  const link =
    /<a[^>]*\brel=['"]license['"][^>]*\bhref=['"]([^'"]+)['"]/i.exec(container[0]) ??
    /<a[^>]*\bhref=['"]([^'"]+)['"][^>]*\brel=['"]license['"]/i.exec(container[0]);
  if (!link) return null;
  const normalised = link[1]!
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/deed\.[a-z_-]+\/?$/, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/$/, '');
  return normalised === REQUIRED_LICENSE ? 'CC BY 3.0' : null;
}

/** `https://fr.globalvoices.org/2026/07/31/298347/` → `2026-07-31-298347`. */
function slugOf(url: string): string {
  const path = new URL(url).pathname.replace(/^\/|\/$/g, '');
  return path.replace(/\//g, '-') || url;
}
