/**
 * seed:voa-le — the VOA Learning English archive: graded English reading, public domain.
 *
 * WHY AN ARCHIVE AND NOT A FEED. voanews.com and learningenglish.voanews.com have been frozen
 * since mid-March 2025 (verified again here: ignoring 125 auto-generated stubs, the newest lastmod
 * in the whole sitemap is 2025-03-31). The "2026" timestamps on their pages are render times. The
 * archive itself is enormous and stays online, so this is a one-time seed, and Global Voices
 * carries the daily English load.
 *
 * FOUR MEASURED FACTS THAT DETERMINE EVERY DECISION BELOW:
 *
 *  1. THE ARCHIVE IS TOO BIG TO SHIP. The sitemap holds 67,274 URLs, of which 32,737 are real
 *     articles. At the measured ~3.9 KB of text each that is ~128 MB raw, and the pack is already
 *     130 MB. Audio is worse by three orders of magnitude: one standard-quality MP3 is 3,450,715
 *     bytes, so the full set is ~113 GB. This seed therefore takes a QUOTA per difficulty band and
 *     bundles no audio at all — the MP3 URL is stored as an outbound link, never fetched.
 *
 *  2. HALF THE SITEMAP HAS NO TEXT. 34,537 of the URLs are `/a/<id>.html` programme pages with no
 *     article body. Slug-form URLs (`/a/<slug>/<id>.html`) are the articles. The 125 stubs are all
 *     bare-numeric too, so filtering to slug form removes them — but every page is still gated on
 *     the presence of a `.wsw` container, because a shape rule is a heuristic and a container is
 *     a fact.
 *
 *  3. AP WIRE COPY IS PERVASIVE — and it is NOT public domain. VOA's grant covers material
 *     produced *exclusively* by VOA. Three of four sampled articles carried an Associated Press
 *     line, in two different senses: a trailing "Lauran Neergaard reported on this story for the
 *     Associated Press. John Russell adapted it for VOA Learning English." means the piece is
 *     AP-derived and is rejected; an inline "Choi told the Associated Press that…" is a quoted
 *     attribution and is kept. Screening per article — not per corpus — is the whole difference
 *     between shipping a public-domain archive and shipping somebody's copyrighted reporting.
 *     Expect this filter to remove much of the news output and leave the teaching programmes,
 *     which is the better half for a learner anyway.
 *
 *  4. THE LEVEL IS NOT IN THE DATA. VOA Learning English publishes at three levels, but no article
 *     carries one: the only "Beginning/Intermediate/Advanced Level" strings on an article page are
 *     the site-wide navigation, identical on every page. The three level landing pages are an
 *     editorial index of PROGRAMMES, and they contradict the programmes' own descriptions — the
 *     Advanced page lists "Words & Their Stories", whose own blurb says it is written "at the
 *     intermediate and upper-beginner level". So no level is copied from VOA. `level_est` is
 *     measured from the article's own text against our CEFR lexicon (lib/level.ts), the same
 *     definition used everywhere else in v0.6, and the programme name is recorded in the
 *     attribution so the editorial grouping is still visible without being trusted as data.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { dailyItemId } from '@mls/shared';
import { recordArtifactSet } from '../../lib/download';
import { polite } from '../../lib/politeness';
import { screenWire } from '../../lib/daily';
import { levelEstimator, LEVEL_ORDER } from '../../lib/level';
import { DATA_CACHE } from '../../lib/paths';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';
import { keywords, mp3Urls, pageTitle, preferStandardQuality, pubDate, wswArticle } from '../../lib/voa';

const SOURCE_ID = 'voa-learning-english';
const HOME = 'https://learningenglish.voanews.com';
const SITEMAP = `${HOME}/sitemap.xml`;
const PARSER_VERSION = 1;

/**
 * How many articles to keep per measured band. THE pack-size lever for this source.
 * Measured: ~3.9 KB of text per article, so 450 articles ≈ 1.8 MB raw / ~0.6 MB gzipped.
 * Raising this is cheap in bytes and expensive in crawl time (one HTTP request per candidate).
 */
const QUOTA_PER_BAND = 75;
/** Stop crawling regardless — a runaway loop over 32,737 URLs is the failure mode to avoid. */
const MAX_FETCHES = 900;

const CACHE = join(DATA_CACHE, 'en', 'voa-le.json');
const CHECKPOINT_EVERY = 25;

interface Cached {
  url: string;
  ok: boolean;
  why?: string;
  title?: string;
  date?: string | null;
  body?: string;
  glossary?: string | null;
  programs?: string[];
  mp3?: string | null;
}

export async function run(db: DB): Promise<void> {
  const urls = await articleUrls();
  console.log(`  sitemap: ${urls.length} article-shaped URLs (slug form)`);

  const cache = loadCache();
  const estimate = levelEstimator(db, 'en');
  const bands = LEVEL_ORDER['en']!;
  const kept = new Map<string, Cached[]>(bands.map((b) => [b, []]));
  const reasons = new Map<string, number>();
  const bump = (why: string) => reasons.set(why, (reasons.get(why) ?? 0) + 1);

  let fetches = 0;
  let sinceCheckpoint = 0;
  for (const url of urls) {
    if (bands.every((b) => kept.get(b)!.length >= QUOTA_PER_BAND)) break;
    if (fetches >= MAX_FETCHES) break;

    let entry = cache.get(url);
    if (!entry) {
      entry = await fetchArticle(url);
      cache.set(url, entry);
      fetches++;
      if (++sinceCheckpoint >= CHECKPOINT_EVERY) {
        saveCache(cache);
        sinceCheckpoint = 0;
        process.stdout.write(`\r  crawled ${fetches} · kept ${[...kept.values()].reduce((a, v) => a + v.length, 0)}   `);
      }
    }
    if (!entry.ok) {
      bump(entry.why ?? 'skipped');
      continue;
    }
    const level = estimate(entry.body ?? '')?.level;
    if (!level) {
      bump('not enough recognised vocabulary to judge');
      continue;
    }
    const bucket = kept.get(level)!;
    if (bucket.length >= QUOTA_PER_BAND) {
      bump(`band ${level} already full`);
      continue;
    }
    bucket.push(entry);
  }
  saveCache(cache);
  process.stdout.write('\r');

  const selected = bands.flatMap((b) => kept.get(b)!.map((a) => ({ band: b, article: a })));
  console.log(`  ✓ crawled ${fetches} pages; kept ${selected.length}`);
  console.log(`    by band: ${bands.map((b) => `${b} ${kept.get(b)!.length}`).join(' · ')}`);
  for (const [why, n] of [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(`    – ${n}× ${why}`);
  if (selected.length === 0) throw new Error('voa-le: nothing selected — the page shape probably changed');

  const bytes = selected.reduce((a, s) => a + (s.article.body?.length ?? 0), 0);
  const hash = createHash('sha256');
  for (const s of selected) hash.update(s.article.url).update(s.article.body ?? '');
  const artifactSha = hash.digest('hex');
  recordArtifactSet({
    id: 'voa-learning-english:articles',
    url: SITEMAP,
    sha256: artifactSha,
    bytes,
    license: 'Public domain (US government work) — VOA Terms of Use',
    notes: `${selected.length} articles, quota ${QUOTA_PER_BAND}/band; wire-agency-derived pieces excluded; no audio bundled`,
  });
  const inputSha = createHash('sha256').update(artifactSha).update(`parser:${PARSER_VERSION}`).digest('hex');
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ voa-le unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'VOA Learning English (archive)',
    url: HOME,
    license: 'Public domain (US government work)',
    licenseUrl: 'https://www.voanews.com/p/5338.html',
    attributionText:
      'Graded English articles from VOA Learning English (learningenglish.voanews.com). Material produced exclusively by the Voice of America is in the public domain; VOA asks that credit be given. Articles whose byline shows they were adapted from a wire agency are excluded, because that material is not covered by the grant. No images or audio are bundled. "Voice of America" is a trademark, used here as a plain-text credit only. The service has been frozen since March 2025; this is an archive, not a feed.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  const insert = db.prepare(`
    INSERT INTO daily_items
      (id, lang, date, kind, title, url, body_text, audio_url, level_est, source_id, curated_note, attribution, published_at)
    VALUES
      (@id, 'en', @date, 'news', @title, @url, @body_text, @audio_url, @level_est, '${SOURCE_ID}', NULL, @attribution, @published_at)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, body_text = excluded.body_text, audio_url = excluded.audio_url,
      level_est = excluded.level_est, attribution = excluded.attribution, published_at = excluded.published_at`);

  let n = 0;
  db.transaction(() => {
    db.prepare(`DELETE FROM daily_items WHERE source_id = ?`).run(SOURCE_ID);
    for (const { band, article } of selected) {
      const date = article.date ?? '2025-03-31';
      const program = article.programs?.[0];
      insert.run({
        // Dated by the article's OWN publication date, not the run date: that is what keeps the id
        // stable across re-seeds and makes "newest first" mean something.
        id: dailyItemId('en', SOURCE_ID, date, slugOf(article.url)),
        date,
        title: article.title ?? article.url,
        url: article.url,
        body_text: article.glossary
          ? `${article.body}\n\n## Words in This Story\n\n${article.glossary}`
          : article.body,
        // Stored, never fetched: 3.4 MB per clip makes bundling impossible, and the app must make
        // no off-origin request on its own. The reader offers it as an explicit outbound link.
        audio_url: article.mp3 ?? null,
        level_est: band,
        attribution: `Voice of America — Learning English${program ? ` · ${program}` : ''}${
          article.date ? ` · ${article.date}` : ''
        } — public domain (US government work), credit requested`,
        published_at: article.date ?? null,
      });
      n++;
    }
  })();

  recordRun(db, SOURCE_ID, n, inputSha);
  console.log(`  ✓ voa-le: ${n} articles, ${(bytes / 1024).toFixed(0)} KB of text, 0 bundled audio`);
}

/** Slug-form article URLs from the sitemap index, newest `lastmod` first. */
async function articleUrls(): Promise<string[]> {
  const index = await fetchText(SITEMAP);
  const subs = [...index.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((m) => m[1]!)
    .filter((u) => /sitemap_\d+_\d+\.xml(?:\.gz)?$/i.test(u));
  if (subs.length === 0) throw new Error('voa-le: sitemap index carries no numbered sub-sitemaps');

  const entries: { url: string; lastmod: string }[] = [];
  for (const sub of subs) {
    const xml = await fetchText(sub);
    for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]*)<\/lastmod>)?/gi)) {
      entries.push({ url: m[1]!, lastmod: m[2] ?? '' });
    }
  }
  return entries
    .filter((e) => /\/a\/[^/]+\/\d+\.html$/.test(e.url)) //  slug form = has an article body
    .sort((a, b) => b.lastmod.localeCompare(a.lastmod))
    .map((e) => e.url);
}

async function fetchText(url: string): Promise<string> {
  const res = await polite(url);
  if (!res.ok) throw new Error(`voa-le: HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Sub-sitemaps are gzipped; the index is not. Sniff rather than trust the extension.
  const body = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf;
  return body.toString('utf8');
}

async function fetchArticle(url: string): Promise<Cached> {
  let html: string;
  try {
    const res = await polite(url, { headers: { accept: 'text/html' } });
    if (!res.ok) return { url, ok: false, why: `HTTP ${res.status}` };
    html = await res.text();
  } catch (e) {
    return { url, ok: false, why: `fetch failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  const article = wswArticle(html);
  if (!article || article.body.length < 400) return { url, ok: false, why: 'no article body' };

  const wire = screenWire(article.body);
  if (wire.derived) return { url, ok: false, why: 'wire-agency byline' };

  const date = pubDate(html);
  if (!date) return { url, ok: false, why: 'no usable publication date' };

  const title = pageTitle(html);
  return {
    url,
    ok: true,
    ...(title ? { title } : {}),
    date,
    body: article.body,
    glossary: article.glossary,
    programs: keywords(html),
    mp3: preferStandardQuality(mp3Urls(html)),
  };
}

function loadCache(): Map<string, Cached> {
  if (!existsSync(CACHE)) return new Map();
  try {
    return new Map(Object.entries(JSON.parse(readFileSync(CACHE, 'utf8')) as Record<string, Cached>));
  } catch {
    return new Map();
  }
}

function saveCache(cache: Map<string, Cached>): void {
  mkdirSync(join(DATA_CACHE, 'en'), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(Object.fromEntries(cache)));
}

/** `/a/how-daylight-savings-time-affects-health/8001173.html` → `8001173`. */
function slugOf(url: string): string {
  const m = /\/a\/(?:.*\/)?(\d+)\.html$/.exec(url);
  return m ? m[1]! : url.replace(/[^\p{L}\p{N}]+/gu, '-');
}
