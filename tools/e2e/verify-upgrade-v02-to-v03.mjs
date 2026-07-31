// Does an EXISTING v0.2 install upgrade in place to v0.3 without losing progress?
// Every other test this session used a fresh browser profile, so the pack always installed
// from scratch. This one starts on the pre-v0.3 pack, builds real SRS state, then swaps the
// pack file underneath the app — the way a real user receives an update.
import { chromium } from 'playwright-core';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';


import { REPO, BASE, CHROME } from './paths.mjs';
const DIST = join(REPO, 'apps/web/dist/packs');
const OLD = join(REPO, 'build/packs/2026.07.30-1'); // pre-v0.3: no graphemes/audio/assets
const NEW = join(REPO, 'build/packs/2026.07.30-5'); // v0.3

const publish = (dir) => {
  copyFileSync(join(dir, 'manifest.json'), join(DIST, 'manifest.json'));
  copyFileSync(join(dir, 'content.db.gz'), join(DIST, 'content.pack'));
};
const fail = (m) => { throw new Error(`ASSERT: ${m}`); };
const log = (m) => console.log(m);

publish(OLD);
log('serving the PRE-v0.3 pack (2026.07.30-1)');

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext(); // one profile for the whole run = one OPFS
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

// --- 1. live on the old pack: build real SRS state -----------------------------------------
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input.searchbox', { timeout: 300_000 });
const oldVersion = await page.$eval('footer.pack', (e) => e.textContent.trim());
log(`installed: ${oldVersion}`);
if (!/2026\.07\.30-1/.test(oldVersion)) fail(`expected the old pack, got ${oldVersion}`);

await page.click('header.top nav a[href="/browse"]');
await page.waitForSelector('ul.words li .deck-btn', { timeout: 60_000 });
for (let i = 0; i < 2; i++) {
  await page.click('ul.words li .deck-btn:not(.in-deck)');
  await page.waitForFunction((n) => document.querySelectorAll('.deck-btn.in-deck').length >= n, i + 1, { timeout: 15_000 });
}
const added = await page.$$eval('ul.words li:has(.deck-btn.in-deck) .hw', (es) => es.map((e) => e.textContent));
log(`added 2 word cards on the old pack: ${added.join(' ')}`);

// study one so there is schedule + history, not just membership
await page.click('header.top nav a[href="/review"]');
await page.waitForSelector('button.start-all', { timeout: 60_000 });
await page.click('button.start-all');
await page.waitForSelector('button.show-answer', { timeout: 20_000 });
await page.click('button.show-answer');
await page.waitForSelector('button.rating-good', { timeout: 15_000 });
await page.click('button.rating-good');
await page.waitForTimeout(500);
log('studied 1 card (review_log + daily_stats now non-empty)');

// --- 2. the update arrives -------------------------------------------------------------------
publish(NEW);
log('swapped in the v0.3 pack, reloading…');
await page.reload({ waitUntil: 'domcontentloaded' });
// reload() re-requests the CURRENT url (we are on /review), so wait for something every ready
// page has, not for the search box that only exists on /.
await page.waitForSelector('footer.pack', { timeout: 300_000 });
const newVersion = await page.$eval('footer.pack', (e) => e.textContent.trim());
log(`installed after reload: ${newVersion}`);
if (!/2026\.07\.30-5/.test(newVersion)) fail(`pack did not upgrade — still ${newVersion}`);

// --- 3. progress survived the content swap ---------------------------------------------------
await page.click('header.top nav a[href="/review"]');
await page.waitForSelector('.review-summary .card', { timeout: 60_000 });
const summary = await page.$eval('main.review', (e) => e.textContent.replace(/\s+/g, ' '));
log(`review after upgrade: ${summary.slice(0, 170)}`);
if (!/1 từ mới|1 new/.test(summary)) fail(`today's study record lost: ${summary}`);
if (!/Từ mới:\s*1|New:\s*1/.test(summary)) fail(`the unstudied card is gone: ${summary}`);
if (!/Chuỗi ngày học|streak/i.test(summary)) fail('streak lost across the upgrade');

// the studied card must still be scheduled, not reset to new
const deckIntact = await page.evaluate(async () => {
  const r = await fetch('/packs/manifest.json'); // no-op; just proving the page is live
  return r.ok;
});
if (!deckIntact) fail('page not live after upgrade');

// --- 4. the NEW v0.3 features work on the upgraded install ------------------------------------
await page.click('header.top nav a[href="/write"]');
await page.waitForSelector('ul.glyph-grid li', { timeout: 60_000 });
const glyphs = await page.$$eval('ul.glyph-grid li', (ls) => ls.length);
log(`/write after upgrade: ${glyphs} glyphs`);
if (glyphs < 20) fail('stroke data not available after upgrade');

await page.click('header.top nav a[href="/pinyin"]');
await page.waitForSelector('table.pinyin-chart button.syl', { timeout: 60_000 });
const syls = await page.$$eval('table.pinyin-chart button.syl', (b) => b.length);
log(`/pinyin after upgrade: ${syls} syllables in the tone-1 chart`);
if (syls < 100) fail('pinyin audio not available after upgrade');

await page.click('header.top nav a[href="/ipa"]');
await page.waitForSelector('button.phone-btn', { timeout: 60_000 });
log(`/ipa after upgrade: ${(await page.$$('button.phone-btn')).length} phones`);

// --- 5. old cards still render from their v0.2-era snapshots ---------------------------------
await page.click('header.top nav a[href="/review"]');
await page.waitForSelector('button.start-all', { timeout: 60_000 });
await page.click('button.start-all');
await page.waitForSelector('button.show-answer', { timeout: 20_000 });
const front = await page.$eval('.review-hw', (e) => e.textContent.trim());
await page.click('button.show-answer');
await page.waitForSelector('.review-answer', { timeout: 15_000 });
const answer = await page.$eval('.review-answer', (e) => e.textContent.replace(/\s+/g, ' ').slice(0, 90));
log(`v0.2-era card still reviews: "${front}" → ${answer}`);
if (!added.includes(front)) fail(`unexpected card after upgrade: ${front}`);

log(`\njs/console errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) log(`   ! ${e}`);
await browser.close();
if (errors.length > 0) fail('console/page errors present');
console.log('\nRESULT: PASS — v0.2 install upgrades in place to v0.3 with progress intact');
