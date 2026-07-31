/**
 * seed:zh-grammar — the OFFICIAL HSK 3.0 graded grammar syllabus, from ivankra/hsk30.
 *
 * This is the open alternative to the Chinese Grammar Wiki, which is the better-known reference
 * and is CC BY-NC-SA 3.0 — NonCommercial, so it may be LINKED but never bundled (invariant 2,
 * and `pack verify` fails on a link-only source that carries body text). The official MOE list
 * gives us the syllabus itself: 573 grammar points, graded HSK1 → HSK7-9, which is exactly the
 * skeleton a learner needs to know what to study next and in what order.
 *
 * What this seed deliberately does NOT do is invent English or Vietnamese for the points. The
 * source is entirely Chinese, and its `Category` column is not a taxonomy that could be
 * translated wholesale — 135 distinct values, most of which are grammar PATTERNS (`还是……吧`,
 * `X就X（点儿）吧`) rather than category names. Only `Group` is a real closed taxonomy (12
 * values), so that is the one thing translated, and it is translated in the UI through i18next
 * where user-facing strings belong — not stored as if upstream had said it.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { grammarId } from '@mls/shared';
import { download } from '../../lib/download';
import { DATA_CACHE } from '../../lib/paths';
import { polite, USER_AGENT } from '../../lib/politeness';
import { parseCsv } from '../../lib/text';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'hsk30-grammar';
const REPO = 'https://github.com/ivankra/hsk30';
const URL = 'https://raw.githubusercontent.com/ivankra/hsk30/master/hsk30-grammar.csv';
const PARSER_VERSION = 3; //  3: register CGW as a link-only source (2: per-token links, not search URLs)
const CGW_CACHE = join(DATA_CACHE, 'zh', 'cgw-links.json');

/**
 * The Chinese Grammar Wiki is NC — we may point at it, never copy from it.
 *
 * Linking is not as simple as searching for the point. Measured over 16 real HSK1–2 points, a
 * search URL for the whole point text resolved to an article **2 times out of 16**; the other 14
 * landed on "There were no results", and a "learn more" link that dead-ends is worse than no link.
 * Linking the point's individual TOKENS instead resolved 15 of 16 — the wiki is organised by
 * particle/word (的, 得, 地, 把, 被, 虽然), not by syllabus wording. So each point is split into
 * tokens, every token is checked once against the live wiki, and only the ones that really exist
 * become links.
 */
const CGW_ARTICLE = 'https://resources.allsetlearning.com/chinese/grammar/';
/** MediaWiki serves a 200 "no such article" page in some configurations, so check the body too. */
const CGW_MISSING = /There were no results|does not exist|noarticletext/i;

/**
 * The linkable units inside a grammar point.
 *
 * `的1、地` → 的, 地 (the trailing digit disambiguates senses in the syllabus, not on the wiki);
 * `结果补语1：动词+错/懂/干净` → 错, 懂, 干净. Only short Han runs are kept — a whole clause is
 * never an article title.
 */
function cgwTokens(point: string): string[] {
  const out: string[] = [];
  for (const raw of point.split(/[、，,；;：:／/|+＋()（）"“”\s]+/)) {
    const tok = raw.replace(/[0-9０-９]+$/u, '').trim();
    if (tok.length >= 1 && tok.length <= 4 && /^[\p{Script=Han}]+$/u.test(tok) && !out.includes(tok)) {
      out.push(tok);
    }
  }
  return out.slice(0, 4); //  a handful of good links beats a wall of them
}

/**
 * Does this token have a real article?
 *
 * Only DEFINITIVE answers are cached. A 404 (or a 200 whose body says the article does not exist)
 * is a real "no" and is remembered; a throttle, timeout or transport error is "don't know" and is
 * left uncached so a later run asks again. Caching an unknown as a "no" would silently and
 * permanently delete a link that does exist — and it would look exactly like a correct result.
 */
async function cgwResolves(token: string, cache: Map<string, boolean>): Promise<boolean> {
  const hit = cache.get(token);
  if (hit !== undefined) return hit;
  // Slower than polite()'s default on purpose. At the standard 250 ms spacing this wiki rate-
  // limits us and every request pays polite()'s full 2s/4s/8s retry ladder — measured ~15 s per
  // token, with most answers being throttles. At ~800 ms spacing the same checks answer
  // instantly and cleanly. Gentler is faster here.
  await new Promise((r) => setTimeout(r, 700));
  try {
    const res = await polite(CGW_ARTICLE + encodeURIComponent(token), {
      // The wiki 403s unfamiliar agents; identify as a browser but keep our contact address.
      headers: { 'user-agent': `Mozilla/5.0 (compatible; ${USER_AGENT})` },
    });
    if (res.status === 404) {
      cache.set(token, false);
      return false;
    }
    if (!res.ok) return false; //  throttled/blocked — unknown, so do not remember it
    const ok = !CGW_MISSING.test(await res.text());
    cache.set(token, ok);
    return ok;
  } catch {
    return false; //  unreachable ⇒ no link this run, but ask again next time
  }
}

/** `1`…`6`, `7-9` → the same level strings the words table already uses. */
function levelOf(raw: string): string | null {
  const v = raw.trim();
  if (/^[1-6]$/.test(v)) return `HSK${v}`;
  if (v === '7-9') return 'HSK7-9';
  return null;
}

export async function run(db: DB): Promise<void> {
  const path = await download({
    id: 'hsk30:hsk30-grammar.csv',
    url: URL,
    relPath: 'zh/hsk30-grammar.csv',
    license: 'MIT (repository); the underlying list is the official HSK 3.0 grammar syllabus (PRC MOE)',
    notes: 'official graded grammar points, OCR-cleaned by ivankra',
  });

  // Whole-document parse, not line-by-line: points wrap across lines inside quoted fields, and
  // splitting on newlines reads 625 broken rows where there are 573 whole ones.
  const rows = parseCsv(readFileSync(path, 'utf8')).filter((r) => r.length > 1 && r[0]);
  const header = rows[0] ?? [];
  if (header[1] !== 'Level' || header[5] !== 'Content') {
    throw new Error(`hsk30-grammar.csv columns moved: ${header.join(',')}`);
  }
  const data = rows.slice(1);

  const inputSha = createHash('sha256')
    .update(readFileSync(path))
    .update(`parser:${PARSER_VERSION}`)
    .digest('hex');
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ zh-grammar unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'HSK 3.0 official grammar syllabus (via ivankra/hsk30)',
    url: REPO,
    license: 'MIT (repository); official PRC MOE grammar list',
    licenseUrl: 'https://github.com/ivankra/hsk30/blob/master/LICENSE',
    attributionText:
      'Graded grammar points from the official HSK 3.0 standard (Chinese Ministry of Education), OCR-cleaned and published as CSV by ivankra under the MIT license.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  // The wiki we link out to is registered too, as link-only: its name appears in the UI on every
  // zh grammar page, so the Licenses screen should say what it is and why none of its text is in
  // the pack. `pack verify` fails any row of a link-only source that carries body text — this row
  // owns no rows at all, which is the point.
  registerSource(db, {
    id: 'chinese-grammar-wiki',
    name: 'Chinese Grammar Wiki (AllSet Learning)',
    url: 'https://resources.allsetlearning.com/chinese/grammar/',
    license: 'CC BY-NC-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
    attributionText:
      'Grammar explanations are linked to the Chinese Grammar Wiki by AllSet Learning. Its license is NonCommercial, so none of its text is bundled in this app — the links open the wiki itself.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'link-only',
  });

  // Resolve the outbound links BEFORE writing anything: the wiki is checked once per distinct
  // token and cached on disk, so a re-run costs nothing and an outage degrades to "no link".
  mkdirSync(join(DATA_CACHE, 'zh'), { recursive: true });
  const cache = new Map<string, boolean>(
    existsSync(CGW_CACHE) ? Object.entries(JSON.parse(readFileSync(CGW_CACHE, 'utf8')) as Record<string, boolean>) : [],
  );
  const pointsOf = new Map<string, string[]>();
  for (const r of data) {
    const point = (r[5] ?? '').trim() || (r[4] ?? '').trim() || (r[3] ?? '').trim();
    if (point) pointsOf.set(point, cgwTokens(point));
  }
  const distinct = [...new Set([...pointsOf.values()].flat())];
  const unchecked = distinct.filter((t) => !cache.has(t));
  if (unchecked.length > 0) console.log(`  checking ${unchecked.length} Grammar Wiki titles (${distinct.length - unchecked.length} cached)…`);
  let checked = 0;
  for (const tok of unchecked) {
    await cgwResolves(tok, cache);
    // Checkpoint as we go. Writing only after the whole loop succeeds is the same mistake the
    // v0.4 review caught in the Lingua Libre licence cache: one failure at token 500 discards
    // 499 answers and makes the next run re-ask a courtesy host for all of them.
    if (++checked % 25 === 0) writeFileSync(CGW_CACHE, JSON.stringify(Object.fromEntries(cache)));
    if (checked % 100 === 0) console.log(`    …${checked}/${unchecked.length}`);
  }
  writeFileSync(CGW_CACHE, JSON.stringify(Object.fromEntries(cache)));
  const linkable = distinct.filter((t) => cache.get(t) === true);
  console.log(`  ✓ Grammar Wiki: ${linkable.length}/${distinct.length} tokens have a real article`);

  const insert = db.prepare(`
    INSERT INTO grammar_topics (id, lang, code, title_en, title_vi, level, ord, body_md, external_links, source_id)
    VALUES (@id, 'zh', @code, @title_en, NULL, @level, @ord, @body_md, @external_links, '${SOURCE_ID}')
    ON CONFLICT(id) DO UPDATE SET
      code = excluded.code, title_en = excluded.title_en, level = excluded.level,
      ord = excluded.ord, body_md = excluded.body_md, external_links = excluded.external_links`);

  let n = 0;
  let skipped = 0;
  const seen = new Set<string>();
  db.transaction(() => {
    // Selection can change when upstream edits the list; upserts never remove.
    db.prepare(`DELETE FROM grammar_topics WHERE source_id = ?`).run(SOURCE_ID);

    for (const r of data) {
      const [no, rawLevel, group, category, details, content] = [r[0] ?? '', r[1] ?? '', r[2] ?? '', r[3] ?? '', r[4] ?? '', r[5] ?? ''];
      const level = levelOf(rawLevel);
      if (!level) { skipped++; continue; }

      // The point itself is whatever upstream is most specific about: 142 rows carry no Content,
      // and for those the Details column IS the grammar point.
      const point = (content.trim() || details.trim() || category.trim());
      if (!point) { skipped++; continue; }

      // Unique across all 573 rows (level+category+details+content); level+details+content alone
      // collides 96 times. Content is part of the key, so an upstream rewording moves the ID —
      // acceptable while grammar is a reader and carries no SRS cards, but it is the reason this
      // must be revisited before grammar becomes card-backed.
      const id = grammarId('zh', SOURCE_ID, [rawLevel, category, details, point].join(' '));
      if (seen.has(id)) { skipped++; continue; }
      seen.add(id);

      // Title = the point as upstream states it. It is Chinese because a Chinese grammar point's
      // name is Chinese; the surrounding taxonomy is what gets localised, in the UI.
      const title = details.trim() && details.trim() !== point ? `${details.trim()}：${point}` : point;

      insert.run({
        id,
        code: no.trim() || null,
        title_en: title,
        level,
        ord: Number(no) || n,
        // body_md carries the official wording only. There is no explanation here to bundle —
        // the good explanations live behind an NC license, which is why the link below exists.
        body_md: [group && `**${group}** · ${category}`, details && details !== point ? details : '', content.trim()]
          .filter(Boolean)
          .join('\n\n') || point,
        // Only tokens with a verified article. A point with no match gets no link at all —
        // rendering a dead "learn more" is worse than admitting we have nothing to offer.
        external_links: (() => {
          const links = (pointsOf.get(point) ?? [])
            .filter((tk) => cache.get(tk) === true)
            .map((tk) => ({ label: `Chinese Grammar Wiki: ${tk}`, url: CGW_ARTICLE + encodeURIComponent(tk) }));
          return links.length > 0 ? JSON.stringify(links) : null;
        })(),
      });
      n++;
    }
  })();

  recordRun(db, SOURCE_ID, n, inputSha);
  const byLevel = db
    .prepare(`SELECT level, COUNT(*) n FROM grammar_topics WHERE source_id = ? GROUP BY level ORDER BY level`)
    .all(SOURCE_ID) as { level: string; n: number }[];
  console.log(`  ✓ zh-grammar: ${n} official grammar points (${skipped} skipped)`);
  console.log(`    ${byLevel.map((r) => `${r.level} ${r.n}`).join(' · ')}`);
}
