// v0.3 P4d acceptance: "trace é" — the last clause of the 0.3 roadmap row.
//  1. /write offers a Latin script tab listing all 64 authored glyphs
//  2. /write/é renders through the SAME hanzi-writer component as a character
//  3. the authored strokes are real closed outlines: the trace quiz completes when driven by
//     the glyph's own medians (a centreline would clip to nothing and never match)
//  4. é is composed as e + acute — 2 strokes, in that order
//  5. a Latin glyph can be added to the SRS deck like any other grapheme
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';


import { REPO, BASE, CHROME } from './paths.mjs';
const GLYPH = 'é';

const require = createRequire(`${REPO}/apps/ingest/package.json`);
const Database = require('better-sqlite3');
const packsDir = join(REPO, 'build', 'packs');
const newest = readdirSync(packsDir).sort().at(-1);
const pdb = new Database(join(packsDir, newest, 'content.db'), { readonly: true });
const letters = pdb.prepare(`SELECT glyph, stroke_json FROM graphemes WHERE kind='letter' ORDER BY ord`).all();
const target = letters.find((l) => l.glyph === GLYPH);
pdb.close();
if (!target) throw new Error(`ASSERT: ${GLYPH} not in the pack`);
const { strokes, medians } = JSON.parse(target.stroke_json);
console.log(`pack ${newest}: ${letters.length} Latin glyphs; ${GLYPH} has ${strokes.length} strokes`);
// every stroke path must be closed — that is what hanzi-writer clips against
for (const [i, d] of strokes.entries()) if (!/Z\s*$/.test(d)) throw new Error(`ASSERT: stroke ${i} is not a closed outline`);

const SIZE = 260, PADDING = 12, PRE = 1024;
const scale = (SIZE - 2 * PADDING) / PRE;
const xOffset = PADDING, yOffset = 124 * scale + PADDING;
const toLocal = ([cx, cy]) => ({ x: cx * scale + xOffset, y: SIZE - yOffset - cy * scale });

const fail = (m) => { throw new Error(`ASSERT: ${m}`); };
const log = (m) => console.log(m);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input.searchbox', { timeout: 300_000 });
await page.click('header.top nav a[href="/write"]');
await page.waitForSelector('ul.glyph-grid li', { timeout: 120_000 });

// --- 1. Latin tab ---------------------------------------------------------------------------
await page.click('.chips.script button:nth-of-type(2)');
await page.waitForSelector('.glyph.latin', { timeout: 30_000 });
const shown = await page.$$eval('.glyph.latin', (gs) => gs.map((g) => g.textContent));
log(`Latin tab: ${shown.length} glyphs — ${shown.slice(0, 30).join('')}`);
if (shown.length !== letters.length) fail(`expected ${letters.length} letters, got ${shown.length}`);
if (!shown.includes(GLYPH)) fail(`${GLYPH} missing from the Latin tab`);

// --- 2. the glyph page uses the same writer -------------------------------------------------
await page.click(`ul.glyph-grid a[href="/write/${encodeURIComponent(GLYPH)}"]`);
await page.waitForSelector('.stroke-stage svg', { timeout: 60_000 });
const head = await page.$eval('.glyph-head', (e) => e.textContent.replace(/\s+/g, ' '));
log(`glyph page: ${head}`);
if (!new RegExp(`${strokes.length} (nét|strokes)`).test(head)) fail(`stroke count ${strokes.length} not shown: ${head}`);

// --- 4. é = e then acute --------------------------------------------------------------------
if (strokes.length !== 2) fail(`é should be 2 strokes (e + acute), got ${strokes.length}`);
const accentEndY = medians[1][medians[1].length - 1][1];
const bodyMaxY = Math.max(...medians[0].map((p) => p[1]));
if (!(accentEndY > bodyMaxY)) fail('the acute must sit above the e body');
log(`stroke order: e body (${medians[0].length} pts) then acute (${medians[1].length} pts, above the body)`);

// --- 3. THE point: trace é ------------------------------------------------------------------
await page.click('button.sw-trace');
await page.waitForTimeout(400);
const box = await page.$eval('.stroke-stage svg', (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top }; });
for (let s = 0; s < medians.length; s++) {
  const pts = medians[s].map(toLocal).map((p) => ({ x: p.x + box.left, y: p.y + box.top }));
  await page.mouse.move(pts[0].x, pts[0].y);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  log(`  stroke ${s + 1}/${medians.length} → ${(await page.$eval('.stroke-status', (e) => e.textContent)).trim()}`);
}
await page.waitForFunction(
  () => /Hoàn hảo|Perfect|Xong!|Done!/.test(document.querySelector('.stroke-status')?.textContent ?? ''),
  null, { timeout: 20_000 },
);
log(`ACCEPTANCE OK: traced ${GLYPH} → "${(await page.$eval('.stroke-status', (e) => e.textContent)).trim()}"`);

// --- 5. Latin glyph joins the SRS deck ------------------------------------------------------
await page.click('.glyph-detail .deck-btn');
await page.waitForSelector('.glyph-detail .deck-btn.in-deck', { timeout: 15_000 });
await page.click('header.top nav a[href="/review"]');
await page.waitForSelector('.review-summary .card', { timeout: 60_000 });
await page.waitForFunction(
  () => /Từ mới:\s*1|New:\s*1/.test(document.querySelector('main.review')?.textContent ?? ''),
  null, { timeout: 30_000 },
);
log('Latin glyph added to the deck and counted in the review queue');

log(`js/console errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) log(`   ! ${e}`);
await browser.close();
if (errors.length > 0) fail('console/page errors present');
console.log('\nRESULT: PASS — v0.3 P4d acceptance met (trace é)');
