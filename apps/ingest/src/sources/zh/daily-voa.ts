/**
 * daily:voa-zh — fresh Mandarin news from VOA Chinese (美国之音中文网).
 *
 * WHY THIS SOURCE. It is the only DAILY Mandarin news service verified to be both publishing and
 * legally bundleable. VOA's Terms of Use put material "produced exclusively by the Voice of
 * America" in the public domain; every other candidate failed on licence, not on content — RFA is
 * a copyrighted USAGM *grantee* (the public-domain rule does not extend to grantees), UN News
 * grants personal non-commercial use only, and Global Voices' Chinese editions have been stale
 * since 2024. Measured on 2026-07-31: the feed carried 20 items spanning ~2 days, newest 2.5 h old.
 *
 * THE FEED URL IS HARDCODED ON PURPOSE. https://www.voachinese.com/rssfeeds is the documented
 * index, and it is not deterministic — two fetches two minutes apart returned two structurally
 * different pages (46 VOA Learning English programme feeds one time, 27 Chinese section feeds the
 * next). Resolving the feed at run time would make the daily pull depend on which page the CDN
 * happened to serve. The token below is pinned instead, and the module fails loudly if it dies.
 *
 * NO LEVEL IS INVENTED. This is native-register news; VOA grades none of it. `level_est` is
 * therefore not a CEFR/HSK grading but a coverage measure against our own levelled lexicon — see
 * lib/level.ts, which is explicit about what that number is and is not.
 */
import { parseFeed, htmlToText } from '../../lib/feed';
import { polite } from '../../lib/politeness';
import { screenWire, writeDailyItems, type DailyItem } from '../../lib/daily';
import { levelEstimator } from '../../lib/level';
import { registerSource, recordRun, type DB } from '../../lib/staging';
import { wswArticle, pubDate } from '../../lib/voa';

const SOURCE_ID = 'voa-chinese';
/** '新闻' (news). Pinned — see the note above about /rssfeeds being non-deterministic. */
const FEED = 'https://www.voachinese.com/api/zm_yql-vomx-tpeybti';
const HOME = 'https://www.voachinese.com/';

/** How many articles to fetch bodies for. The curation step keeps 1–3; this is the candidate pool. */
const MAX_CANDIDATES = 8;
/** Shorter than this and the extraction failed rather than the article being brief. */
const MIN_BODY_CHARS = 120;

export interface DailyResult {
  source: string;
  lang: string;
  stored: number;
  skipped: { url: string; why: string }[];
}

export async function run(db: DB, opts: { date: string }): Promise<DailyResult> {
  const skipped: { url: string; why: string }[] = [];
  const estimate = levelEstimator(db, 'zh');

  const res = await polite(FEED, { headers: { accept: 'application/rss+xml, application/xml' } });
  if (!res.ok) throw new Error(`voa-zh: feed HTTP ${res.status} — ${FEED}`);
  const items = parseFeed(await res.text());
  if (items.length === 0) throw new Error('voa-zh: feed parsed to 0 items (shape changed?)');
  console.log(`  feed: ${items.length} items, newest ${items[0]?.publishedRaw ?? '?'}`);

  const out: DailyItem[] = [];
  for (const item of items.slice(0, MAX_CANDIDATES)) {
    if (!item.link) continue;
    const page = await polite(item.link, { headers: { accept: 'text/html' } });
    if (!page.ok) {
      skipped.push({ url: item.link, why: `HTTP ${page.status}` });
      continue;
    }
    const html = await page.text();
    const article = wswArticle(html);
    if (!article || article.body.length < MIN_BODY_CHARS) {
      skipped.push({ url: item.link, why: 'no .wsw article body' });
      continue;
    }

    // The licence test, applied per article rather than per corpus. VOA's grant covers material
    // produced *exclusively* by VOA; a story a VOA writer adapted from a wire agency is not that,
    // however public-domain the rest of the site is.
    const wire = screenWire(`${item.title}\n${article.body}`);
    if (wire.derived) {
      skipped.push({ url: item.link, why: `wire-derived: ${wire.evidence ?? ''}` });
      continue;
    }

    const byline = bylineOf(html) ?? parenthetical(item.author) ?? '美国之音';
    const published = pubDate(html) ?? item.published;
    // The feed's own <description> is a real one-or-two-sentence Chinese summary written by VOA,
    // which is a better daily-sized read than 1,200 characters of native-register news. It is
    // kept as the lede and the full article follows it.
    const body = [htmlToText(item.summaryHtml), article.body].filter(Boolean).join('\n\n');
    out.push({
      lang: 'zh',
      date: opts.date,
      kind: 'news',
      slug: slugOf(item.link),
      title: item.title,
      url: item.link,
      bodyText: body,
      audioUrl: null,
      levelEst: estimate(body)?.level ?? null,
      attribution: `美国之音 (Voice of America) · ${byline}${published ? ` · ${published}` : ''} — public domain (US government work), credit requested`,
      publishedAt: published,
    });
    if (wire.mentions) console.log(`  · ${item.title.slice(0, 30)}… mentions an agency in quotation (kept)`);
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'VOA Chinese (美国之音中文网)',
    url: HOME,
    license: 'Public domain (US government work)',
    licenseUrl: 'https://www.voanews.com/p/5338.html',
    attributionText:
      'News text from VOA Chinese (voachinese.com). Material produced exclusively by the Voice of America is in the public domain; VOA asks that credit be given. Wire-agency material is excluded from that grant, so each article is screened for an agency byline before it is stored, and photographs are never bundled. "Voice of America" is a trademark and is used here as a plain-text credit only.',
    retrievedAt: opts.date,
    licenseMode: 'bundled',
  });

  const stored = writeDailyItems(db, SOURCE_ID, 'zh', opts.date, out);
  recordRun(db, SOURCE_ID, stored);
  console.log(`  ✓ voa-zh: ${stored} items for ${opts.date}${skipped.length ? ` (${skipped.length} skipped)` : ''}`);
  for (const s of skipped) console.log(`    – ${s.why}`);
  return { source: SOURCE_ID, lang: 'zh', stored, skipped };
}

/** `/a/<slug>/<id>.html` → `<id>`; the numeric id is stable where the slug is editorial. */
function slugOf(url: string): string {
  const m = /\/a\/(?:.*\/)?(\d+)\.html/.exec(url);
  return m ? m[1]! : url.replace(/^https?:\/\//, '').replace(/[^\p{L}\p{N}]+/gu, '-');
}

/** ` chinese@voanews.com (美国之音)` → `美国之音`. */
function parenthetical(author: string | null): string | null {
  if (!author) return null;
  const m = /\(([^)]+)\)/.exec(author);
  return (m ? m[1]! : author).trim() || null;
}

/** The named reporter, when the page carries one — a better credit than the house byline. */
function bylineOf(html: string): string | null {
  const m = /<(?:span|a|div)[^>]*\bclass="[^"]*\bauthor\b[^"]*"[^>]*>([\s\S]{0,120}?)<\/(?:span|a|div)>/i.exec(html);
  if (!m) return null;
  const name = m[1]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return name && name.length <= 40 ? name : null;
}
