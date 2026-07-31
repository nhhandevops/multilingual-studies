// v0.3 P2 acceptance: "Watch 好 draw itself and trace it" (docs/PLAN.md roadmap row 0.3).
//  1. /write index browses hanzi by HSK level and by stroke count
//  2. /write/好 shows reading, stroke count, decomposition with clickable components, words
//  3. the animation renders
//  4. the TRACE quiz is driven with real pointer events along the character's own medians and
//     must complete — this is the check that the stroke data in our pack is actually usable
//  5. word page characters link into /write; Licenses screen carries the Arphic license text
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';


import { REPO, BASE, CHROME, newestPack } from './paths.mjs';
const GLYPH = '好';

// --- read the pack directly: the test's source of truth for medians, not the app -----------
const require = createRequire(`${REPO}/apps/ingest/package.json`);
const Database = require('better-sqlite3');
const packsDir = join(REPO, 'build', 'packs');
const newest = newestPack(readdirSync(packsDir));
const db = new Database(join(packsDir, newest, 'content.db'), { readonly: true });
const { stroke_json, ord } = db
  .prepare(`SELECT stroke_json, ord FROM graphemes WHERE lang='zh' AND kind='hanzi' AND glyph=?`)
  .get(GLYPH);
const { medians } = JSON.parse(stroke_json);
const wordRow = db
  .prepare(`SELECT id, headword FROM words WHERE lang='zh' AND headword LIKE ? AND freq_rank IS NOT NULL
            ORDER BY freq_rank LIMIT 1`)
  .get(`%${GLYPH}%`);
db.close();
console.log(`pack ${newest}: ${GLYPH} has ${medians.length} strokes (ord=${ord}); sample word ${wordRow.headword} (${wordRow.id})`);

// --- hanzi-writer Positioner, inverted (see dist/hanzi-writer.js CHARACTER_BOUNDS) --------
const SIZE = 260, PADDING = 12;
const BOUNDS_FROM = { x: 0, y: -124 };
const PRE = 1024; //                         makemeahanzi bbox is 1024×1024
const scale = (SIZE - 2 * PADDING) / PRE;
const xOffset = -BOUNDS_FROM.x * scale + PADDING;
const yOffset = -BOUNDS_FROM.y * scale + PADDING;
const toLocal = ([cx, cy]) => ({ x: cx * scale + xOffset, y: SIZE - yOffset - cy * scale });

const fail = (msg) => { throw new Error(`ASSERT: ${msg}`); };
const log = (m) => console.log(m);

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
});
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

// --- boot (41 MB pack now — allow time) ---------------------------------------------------
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input.searchbox', { timeout: 300_000 });
log('boot: pack installed');

// --- 1. /write index ----------------------------------------------------------------------
await page.goto(`${BASE}/write`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('ul.glyph-grid li', { timeout: 60_000 });
const hsk1Count = await page.$$eval('ul.glyph-grid li', (ls) => ls.length);
log(`/write HSK1 grid: ${hsk1Count} glyphs`);
if (hsk1Count < 20) fail(`HSK1 grid too small (${hsk1Count})`);

// stroke-count filter: pick "1" and expect only 1-stroke characters
// target the row by class, not position: /write gained a script-toggle row above it
const oneStroke = await page.$('.chips.strokes button');
if (!oneStroke) fail('stroke-count chip row not found');
await oneStroke.click();
await page.waitForFunction(
  () => document.querySelectorAll('ul.glyph-grid li').length > 0
     && [...document.querySelectorAll('ul.glyph-grid li .hint')].every((e) => /^1 /.test(e.textContent)),
  null,
  { timeout: 20_000 },
);
const oneStrokeGlyphs = await page.$$eval('ul.glyph-grid .glyph', (es) => es.map((e) => e.textContent).join(''));
log(`stroke-count filter (1 stroke): ${oneStrokeGlyphs}`);

// --- 2. /write/好 --------------------------------------------------------------------------
await page.goto(`${BASE}/write/${encodeURIComponent(GLYPH)}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.stroke-stage svg', { timeout: 60_000 });
const head = await page.$eval('.glyph-head', (el) => el.textContent.replace(/\s+/g, ' '));
log(`detail head: ${head}`);
if (!/hǎo/.test(head)) fail(`reading missing from head: ${head}`);
if (!new RegExp(`${ord} (nét|strokes)`).test(head)) fail(`stroke count ${ord} missing: ${head}`);
if (!/女/.test(head)) fail(`radical 女 missing: ${head}`);

const decomp = await page.$eval('.decomposition', (el) => el.textContent);
log(`decomposition: ${decomp}`);
if (decomp !== '⿰女子') fail(`unexpected decomposition ${decomp}`);
// haveStrokeData resolves after the detail render, so poll instead of reading once
await page.waitForFunction(() => document.querySelectorAll('.decomposition a').length === 2, null, { timeout: 20_000 });
const compLinks = await page.$$eval('.decomposition a', (as) => as.map((a) => a.textContent));
if (compLinks.join('') !== '女子') fail(`components should both be links, got ${compLinks.join('')}`);

const inWords = await page.$$eval('.glyph-detail ul.words li .hw', (es) => es.map((e) => e.textContent));
log(`seen-in-words: ${inWords.slice(0, 8).join(' ')} (${inWords.length} total)`);
if (inWords.length === 0) fail('no words listed for 好');

// components must navigate
await page.click('.decomposition a:first-of-type');
await page.waitForFunction(() => /女/.test(document.querySelector('.glyph-detail .hw')?.textContent ?? ''), null, { timeout: 20_000 });
log('component link 女 navigates to its own writing page');
await page.goBack({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.stroke-stage svg', { timeout: 30_000 });

// --- 3. animation renders ------------------------------------------------------------------
const pathsBefore = await page.$$eval('.stroke-stage svg path', (ps) => ps.length);
await page.click('button.sw-animate');
await page.waitForTimeout(1200);
log(`svg paths: ${pathsBefore} (outline+strokes for a ${ord}-stroke character)`);
if (pathsBefore < ord) fail(`expected >= ${ord} paths, got ${pathsBefore}`);

// --- 4. TRACE the character with real pointer events --------------------------------------
await page.click('button.sw-reveal');
await page.click('button.sw-trace');
await page.waitForTimeout(400);
const box = await page.$eval('.stroke-stage svg', (el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top };
});
for (let s = 0; s < medians.length; s++) {
  const pts = medians[s].map(toLocal).map((p) => ({ x: p.x + box.left, y: p.y + box.top }));
  await page.mouse.move(pts[0].x, pts[0].y);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(180);
  const status = await page.$eval('.stroke-status', (el) => el.textContent);
  log(`  stroke ${s + 1}/${medians.length} → ${status.trim()}`);
}
await page.waitForFunction(
  () => /Hoàn hảo|Perfect|Xong!|Done!/.test(document.querySelector('.stroke-status')?.textContent ?? ''),
  null,
  { timeout: 20_000 },
);
const traced = await page.$eval('.stroke-status', (el) => el.textContent.trim());
log(`ACCEPTANCE OK: traced ${GLYPH} end to end → "${traced}"`);
if (!/Hoàn hảo|Perfect/.test(traced)) log(`  (note: completed with mistakes — "${traced}")`);

// --- 5. word page characters link into /write ---------------------------------------------
await page.goto(`${BASE}/word/${encodeURIComponent(wordRow.id)}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.word-detail .hw a', { timeout: 60_000 });
const charHrefs = await page.$$eval('.word-detail .hw a', (as) => as.map((a) => a.getAttribute('href')));
log(`word ${wordRow.headword}: character links → ${charHrefs.join(' ')}`);
if (!charHrefs.some((h) => h.includes(encodeURIComponent(GLYPH)))) fail('headword characters do not link to /write');
await page.click(`.word-detail .hw a[href*="${encodeURIComponent(GLYPH)}"]`);
await page.waitForSelector('.stroke-stage svg', { timeout: 30_000 });
log('word → character → writing page navigation works');

// --- 6. Licenses screen carries the Arphic license -----------------------------------------
// Navigate in-app rather than with page.goto: a fresh document load can lose the exclusive
// OPFS handles to a bfcached page (see probe-locked.mjs — that path is covered separately).
await page.click('header.top nav a[href="/licenses"]');
try {
  await page.waitForSelector('main .card', { timeout: 60_000 });
} catch {
  // Report what the app was actually showing — a bare selector timeout tells us nothing.
  const shown = await page.$eval('#root', (el) => el.textContent.replace(/\s+/g, ' ').slice(0, 300)).catch(() => '(no #root)');
  fail(`licenses cards never rendered. App showed: ${shown}`);
}
const licText = await page.$eval('main', (el) => el.textContent.replace(/\s+/g, ' '));
if (!/Arphic Public License/.test(licText)) fail('Arphic Public License not shown on Licenses screen');
if (!/LGPL-3\.0/.test(licText)) fail('LGPL-3.0 (dictionary.txt) not shown on Licenses screen');
const aplHref = await page.$eval('a[href="/licenses/ARPHICPL.TXT"]', (a) => a.getAttribute('href'));
const aplRes = await page.request.get(`${BASE}${aplHref}`);
const aplBody = await aplRes.text();
log(`Licenses: Arphic + LGPL listed; ${aplHref} serves ${aplBody.length} bytes, starts "${aplBody.slice(0, 22)}"`);
if (!/ARPHIC PUBLIC LICENSE/.test(aplBody)) fail('ARPHICPL.TXT does not contain the license text');

// --- wrap-up -------------------------------------------------------------------------------
log(`\njs/console errors: ${errors.length}`);
for (const e of errors.slice(0, 10)) log(`   ! ${e}`);
await browser.close();
if (errors.length > 0) fail('console/page errors present');
console.log('\nRESULT: PASS — v0.3 P2 acceptance met');
