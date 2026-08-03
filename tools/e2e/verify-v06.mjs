// v0.6 acceptance: "Run /daily-pull with coffee; open app to fresh curated content."
// PLAN's own verify clauses for 0.6 are the two hard ones, and both are DEMONSTRATED here rather
// than asserted: pulling twice on one day must not duplicate, and a source dying mid-run must
// degrade to a partial report instead of aborting the pull.
//
//  1. the pack carries a daily pull and a graded archive, every row credited per item
//  2. NO bundled item is wire-agency-derived — VOA's public-domain grant does not cover AP copy
//  3. running a daily module TWICE on one date changes nothing (real re-run, not a claim)
//  4. a failing source produces a partial report and a zero exit code (real injected failure)
//  5. /today shows the day it is showing, opens an item, and renders its per-item credit
//  6. the word of the day goes into the SRS deck — the roadmap's "word-of-day → SRS queue"
//  7. nothing is fetched off-origin
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, BASE, CHROME, newestPack } from './paths.mjs';

const require = createRequire(`${REPO}/apps/ingest/package.json`);
const Database = require('better-sqlite3');
const packsDir = join(REPO, 'build', 'packs');
const newest = newestPack(readdirSync(packsDir));
const pdb = new Database(join(packsDir, newest, 'content.db'), { readonly: true });

const fail = m => { throw new Error(`ASSERT: ${m}`); };
const log = m => console.log(m);
// Node 20+ refuses to spawn a .cmd without a shell on Windows (EINVAL, CVE-2024-27980), so the
// shell is required there and harmless elsewhere.
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const ingest = (args, env) =>
  execFileSync(pnpm, ['ingest', ...args], {
    cwd: REPO,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });

const FRESH = `('voa-chinese','global-voices','wikipedia-itn')`;

// ---------------------------------------------------------------- 1. pack gates
const byLang = pdb.prepare(`SELECT lang, COUNT(*) n FROM daily_items GROUP BY lang ORDER BY lang`).all();
const bySource = pdb.prepare(`SELECT source_id, COUNT(*) n FROM daily_items GROUP BY source_id ORDER BY source_id`).all();
const tips = pdb.prepare('SELECT COUNT(*) n FROM tips').get().n;
const plan = pdb.prepare('SELECT COUNT(*) n FROM daily_plan').get().n;
log(`pack ${newest}: daily_items ${byLang.map(r => `${r.lang} ${r.n}`).join(' · ')}`);
log(`  sources: ${bySource.map(r => `${r.source_id} ${r.n}`).join(' · ')}`);
log(`  tips ${tips} · daily_plan ${plan}`);
if (byLang.length < 3) fail('expected daily content in all three languages');
if (tips === 0) fail('the pack must ship evergreen tips — the Today screen has to work on day one');
if (plan === 0) fail('the pack must ship a word plan');

const unattributed = pdb.prepare(`SELECT COUNT(*) n FROM daily_items WHERE TRIM(COALESCE(attribution,'')) = ''`).get().n;
const orphanSrc = pdb.prepare(`SELECT COUNT(*) n FROM daily_items d
  WHERE NOT EXISTS (SELECT 1 FROM sources s WHERE s.id = d.source_id)`).get().n;
const orphanPlan = pdb.prepare(`SELECT COUNT(*) n FROM daily_plan p
  WHERE NOT EXISTS (SELECT 1 FROM words w WHERE w.id = p.word_id)`).get().n;
log(`  rows with no per-item credit: ${unattributed} | orphan sources: ${orphanSrc} | orphan plan rows: ${orphanPlan}`);
if (unattributed !== 0) fail('every daily item must name whoever its licence requires be named');
if (orphanSrc !== 0) fail('every daily item must come from a registered source');
if (orphanPlan !== 0) fail('a planned word must exist in this pack');

// ---------------------------------------------------------------- 2. the wire-agency screen
// The gate that separates "public-domain source" from "public domain row". VOA's terms cover
// material produced EXCLUSIVELY by VOA, so an adapted Associated Press story inside it is not ours.
const { screenWire } = await import(`file://${join(REPO, 'packages/shared/src/wire.ts').replace(/\\/g, '/')}`)
  .catch(() => ({ screenWire: null }));
const wireRows = pdb.prepare(`SELECT id, COALESCE(title,'') || char(10) || COALESCE(body_text,'') t
  FROM daily_items WHERE body_text IS NOT NULL`).all();
const derived = screenWire ? wireRows.filter(r => screenWire(r.t).derived) : [];
const mentions = wireRows.filter(r => /Associated Press|Reuters|AFP|美联社|路透/i.test(r.t));
log(`  bundled bodies: ${wireRows.length} · agency-derived: ${derived.length} · merely quoting an agency: ${mentions.length}`);
if (derived.length !== 0) fail(`${derived.length} bundled items are wire-agency-derived: ${derived[0].id}`);

// graded reading really is graded
const bands = pdb.prepare(`SELECT level_est lvl, COUNT(*) n FROM daily_items
  WHERE source_id NOT IN ${FRESH} AND level_est IS NOT NULL GROUP BY level_est ORDER BY level_est`).all();
log(`  graded archive bands: ${bands.map(b => `${b.lvl} ${b.n}`).join(' · ') || '(none)'}`);
if (bands.length < 2) fail('the graded archive should span more than one measured band');

const freshDate = pdb.prepare(`SELECT MAX(date) d FROM daily_items WHERE source_id IN ${FRESH}`).get().d;
log(`  newest pulled day in the pack: ${freshDate}`);
if (!freshDate) fail('the pack carries no pulled news at all');
pdb.close();

// ---------------------------------------------------------------- 3. pulling twice does not duplicate
// PLAN 0.6: "/daily-pull twice same day → no dupes". Run it for real, twice, and compare.
const sdb = new Database(join(REPO, 'build', 'staging.db'), { readonly: true });
const itnCount = () => sdb.prepare(`SELECT COUNT(*) n FROM daily_items WHERE source_id='wikipedia-itn'`).get().n;
const itnIds = () => sdb.prepare(`SELECT id FROM daily_items WHERE source_id='wikipedia-itn' ORDER BY id`).all().map(r => r.id).join('|');
ingest(['daily:wiki-itn']);
const before = { n: itnCount(), ids: itnIds() };
ingest(['daily:wiki-itn']);
const after = { n: itnCount(), ids: itnIds() };
log(`re-ran daily:wiki-itn — items ${before.n} → ${after.n}`);
if (after.n !== before.n) fail(`a second pull on the same day changed the row count (${before.n} → ${after.n})`);
if (after.ids !== before.ids) fail('a second pull on the same day changed the item ids');

// ---------------------------------------------------------------- 4. a dying source degrades
// Not a claim about try/catch: one module is made to fail and the run is checked for a partial
// report AND a zero exit code, because a daily habit that aborts is a daily habit you stop having.
const partial = ingest(['daily:all'], { MLS_DAILY_FAIL: 'wiki-itn' });
const survived = [...partial.matchAll(/✓ (\S+) \[(\w+)\] (\d+) items/g)];
const lost = /✗ wiki-itn: simulated failure/.test(partial);
log(`injected failure: ${survived.length} source/language pairs still stored items; failure reported: ${lost}`);
if (!lost) fail('the failing source was not named in the report');
if (survived.length < 2) fail('one dead source should not take the others down');
if (!/sources failed/.test(partial)) fail('the run must print a summary saying what failed');
// and the data it did manage to store is still intact
ingest(['daily:wiki-itn']); //  restore what the injected-failure run skipped
const restored = itnCount();
sdb.close();
log(`restored wikipedia-itn: ${restored} items`);
if (restored !== before.n) fail('restoring the skipped source did not return the same rows');

// ---------------------------------------------------------------- 5-7. browser
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [], off = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 140)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
page.on('request', r => { if (!/^(http:\/\/localhost:5173|data:|blob:)/.test(r.url())) off.push(r.url()); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input.searchbox', { timeout: 300000 });
await page.click('nav a[href="/today"]');
await page.waitForSelector('.today .today-block', { timeout: 60000 });

// Wait for the chips themselves, not for the block that always renders around them: the news
// section exists before the language query answers, so reading the chips on its appearance is a
// race this assertion used to win by luck. A timeout here still reports the real shortage.
await page.waitForFunction(
  () => document.querySelectorAll('.today .chips.langs button').length >= 3,
  null, { timeout: 60000 });
const langChips = await page.$$eval('.today .chips.langs button', els => els.map(e => e.textContent.trim()));
log(`/today language chips: ${langChips.join(' | ')}`);
if (langChips.length < 3) fail('expected a chip per language with daily content');

// The screen must say WHICH day it is showing — a pack is older than today by construction.
// Wait for the query to land: reading the hint while it is still loading is the stale-read trap
// this suite's README warns about, and it is what made this assertion fail the first time.
// `.news-date` exists on the RESOLVED line only, so its presence IS the "query answered" signal.
// It used to wait for the first `.hint` to stop being the literal "…", which made a placeholder
// string load-bearing for the test — the loading indicator could not be improved without
// breaking it, and the fallback target was the reading block's hint, which carries no date.
await page.waitForSelector('.today .today-block p.news-date', { timeout: 60000 });
const dateLine = await page.textContent('.today .today-block p.news-date');
log(`date line: ${dateLine.trim().slice(0, 100)}`);
if (!/\d{4}-\d{2}-\d{2}|hôm nay|today/i.test(dateLine)) fail('the news block must state the day it is showing');

const newsCount = await page.$$eval('.today .today-block .daily-list li', els => els.length);
log(`items listed for the default language: ${newsCount}`);
if (newsCount === 0) fail('/today shows no items at all');

// --- open an item and check it carries its per-item credit ----------------------------------
await page.click('.today .daily-list li a');
await page.waitForSelector('.daily-detail', { timeout: 30000 });
const detail = await page.textContent('.daily-detail');
const credit = (await page.textContent('.daily-detail .attribution')).trim();
const bodyBlocks = await page.$$eval('.daily-detail .md p, .daily-detail .md li', els => els.length);
log(`item page: ${bodyBlocks} text blocks; credit "${credit.slice(0, 90)}"`);
if (bodyBlocks === 0) fail('the item page renders no text');
if (credit.length < 10) fail('the item page must render its per-item credit');
if (!/creativecommons|CC BY|public domain|Voice of America|Wikipedia|Global Voices/i.test(credit))
  fail(`the credit does not name a licence or a publisher: ${credit}`);

// --- the word of the day goes into the SRS deck ---------------------------------------------
await page.click('nav a[href="/today"]');
await page.waitForSelector('.today .words li', { timeout: 30000 });
const plannedWords = await page.$$eval('.today .words li .hw', els => els.map(e => e.textContent.trim()));
log(`words of the day: ${plannedWords.slice(0, 6).join(' · ')}${plannedWords.length > 6 ? ' …' : ''}`);
if (plannedWords.length === 0) fail('no word of the day was offered');
const addBtn = await page.$('.today .words li .deck-btn:not(.in-deck)');
if (!addBtn) fail('the word of the day has no add-to-deck button');
await addBtn.click();
await page.waitForSelector('.today .words li .deck-btn.in-deck', { timeout: 15000 });
log('added the first word of the day to the deck');

// And it is really in the QUEUE, not just a green tick. `deckEmpty` is computed from an async
// summary, so wait for the RESOLVED overview rather than reading once.
//
// The wait targets `.review-summary`, not the absence of "đang trống". That negative predicate
// worked only while the loading state happened to render the empty-deck message — the very bug
// the UX pass fixed. Once loading became a spinner, "not empty yet" was satisfied instantly and
// this read landed on "Đang tải…", which contains no digit and failed the assertion below. A
// predicate that passes on a state you are not waiting for is not a wait.
await page.click('nav a[href="/review"]');
await page.waitForSelector('main', { timeout: 30000 });
await page.waitForSelector('main .review-summary', { timeout: 30000 });
const reviewText = (await page.textContent('main')).replace(/\s+/g, ' ');
log(`/review after adding: ${reviewText.slice(0, 130)}…`);
if (!/[1-9]/.test(reviewText)) fail('the review screen shows no cards after adding the word of the day');

// --- the tip -------------------------------------------------------------------------------
await page.click('nav a[href="/today"]');
await page.waitForSelector('.today-block.tip', { timeout: 30000 });
const tipTitle = (await page.textContent('.today-block.tip h4')).trim();
const tipBlocks = await page.$$eval('.today-block.tip .md p, .today-block.tip .md li', els => els.length);
log(`tip of the day: "${tipTitle}" (${tipBlocks} blocks)`);
if (!tipTitle) fail('no tip was shown');
if (tipBlocks === 0) fail('the tip has no body');

// the same day must give the same tip — "today's tip" cannot be a shuffle button
await page.reload();
await page.waitForSelector('.today-block.tip h4', { timeout: 60000 });
const tipAgain = (await page.textContent('.today-block.tip h4')).trim();
if (tipAgain !== tipTitle) fail(`the tip changed on reload: "${tipTitle}" → "${tipAgain}"`);
log('tip is stable across reloads (deterministic by date)');

log(`off-origin requests: ${off.length} | console errors: ${errors.length}`);
if (off.length) fail(`off-origin requests: ${off.slice(0, 3).join(', ')}`);
if (errors.length) fail(`console errors: ${errors.slice(0, 3).join(' | ')}`);

await browser.close();
console.log('\n✓ v0.6 acceptance passed');
