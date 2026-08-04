// v0.3 P3 acceptance: grapheme cards ride the v0.2 SRS loop.
//  1. add a writing card from /write/:glyph
//  2. it appears in the /review queue counts alongside a word card
//  3. reviewing it shows the stroke writer on the answer side (rendered from the SNAPSHOT)
//  4. rating it schedules it — and the interval grows under the debug clock
//  5. mixed deck: a v0.2-shaped word card and a v0.3 grapheme card coexist in one session
//  6. export/import still round-trips with a grapheme card present (snapshot Zod is backward
//     compatible: `kind`/`strokeJson` are optional)
import { chromium } from 'playwright-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';


import { BASE, CHROME } from './paths.mjs';
const GLYPH = '好';
const DAY = 864e5;

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
page.on('dialog', (d) => void d.accept());

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input.searchbox', { timeout: 300_000 });
log('boot: pack installed');

// in-app navigation throughout (a fresh document load can lose the OPFS handles — see HANDOFF)
const nav = async (href, ready) => {
  await page.click(`header.top nav a[href="${href}"]`);
  await page.waitForSelector(ready, { timeout: 60_000 });
};

// --- 1. add one word card (v0.2 path) and one grapheme card (v0.3 path) -------------------
await nav('/browse', 'ul.words li .deck-btn');
await page.click('ul.words li .deck-btn:not(.in-deck)');
await page.waitForSelector('.deck-btn.in-deck', { timeout: 15_000 });
const wordAdded = await page.$eval('ul.words li:has(.deck-btn.in-deck) .hw', (e) => e.textContent);
log(`word card added: ${wordAdded}`);

// Reach 好 the way a user would: search → word page → click the character. Staying in one
// document is deliberate (a fresh page.goto can lose the exclusive OPFS handles).
await nav('/', 'input.searchbox');
await page.fill('input.searchbox', GLYPH);
await page.waitForFunction(
  (g) => [...document.querySelectorAll('ul.words .hw')].some((e) => e.textContent.trim() === g),
  GLYPH,
  { timeout: 30_000 },
);
await page.click(`ul.words li:has(.hw:text-is("${GLYPH}")) a`);
await page.waitForSelector(`.word-detail .hw a[href="/write/${encodeURIComponent(GLYPH)}"]`, { timeout: 60_000 });
await page.click(`.word-detail .hw a[href="/write/${encodeURIComponent(GLYPH)}"]`);
await page.waitForSelector('.glyph-detail .deck-btn', { timeout: 60_000 });
await page.click('.glyph-detail .deck-btn');
await page.waitForSelector('.glyph-detail .deck-btn.in-deck', { timeout: 15_000 });
log(`grapheme card added: ${GLYPH}`);

// --- 2. both show up in the review queue --------------------------------------------------
await nav('/review', '.review-summary .card');
await page.waitForFunction(
  () => /Từ mới:\s*2|New:\s*2/.test(document.querySelector('main.review')?.textContent ?? ''),
  null,
  { timeout: 30_000 },
);
log('review overview: 2 new cards available (1 word + 1 grapheme)');

// --- 3+5. session: the grapheme card renders the writer from its snapshot -----------------
await page.click('button.start-all');
let sawWriterInReview = false;
let sawPlainWordCard = false;
let graduationIv = null;
for (let i = 0; i < 30; i++) {
  const done = await page.$('main.review h2');
  if (done && /Xong|complete/i.test(await done.textContent())) break;
  await page.waitForSelector('button.show-answer', { timeout: 15_000 });
  const front = await page.$eval('.review-hw', (e) => e.textContent.trim());
  await page.click('button.show-answer');
  await page.waitForSelector('button.rating-good', { timeout: 15_000 });
  const hasWriter = (await page.$('.review-answer .stroke-stage svg')) !== null;
  if (front === GLYPH) {
    if (!hasWriter) fail(`grapheme card ${GLYPH} must show the stroke writer on the answer side`);
    const glyphLink = await page.$(`a[href="/write/${encodeURIComponent(GLYPH)}"]`);
    if (!glyphLink) fail('grapheme card should link to its character page, not /word/:id');
    sawWriterInReview = true;
  } else if (hasWriter) {
    fail(`word card ${front} must NOT show a stroke writer`);
  } else {
    sawPlainWordCard = true;
  }
  const iv = await page.$eval('button.rating-good .iv', (e) => e.textContent);
  if (/ngày|d\b/.test(iv)) graduationIv = iv;
  await page.click('button.rating-good');
  await page.waitForTimeout(180);
}
if (!sawWriterInReview) fail('never saw the grapheme card in the session');
if (!sawPlainWordCard) fail('never saw the word card in the session');
log(`session: grapheme card showed the writer, word card did not (graduation interval ${graduationIv})`);

await page.waitForFunction(
  () => /2 từ mới|2 new/.test(document.querySelector('main.review')?.textContent ?? ''),
  null,
  { timeout: 15_000 },
);
log('done screen: 2 new cards studied');

// --- 6. export with a grapheme card present ------------------------------------------------
// the done screen owns its own way back to the overview; the nav link would leave phase='done'
await page.click('main.review button.more');
await page.waitForSelector('.backup button', { timeout: 60_000 });
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 30_000 }),
  page.click('.backup button.export-backup'),
]);
const backupPath = join(mkdtempSync(join(tmpdir(), 'mls-p3-')), 'user-backup.db');
await download.saveAs(backupPath);
log(`backup saved with a grapheme card in it: ${backupPath}`);

// --- 4. debug clock: the grapheme card comes due and its interval grows --------------------
await page.evaluate((ms) => localStorage.setItem('mls_debug_clock_offset_ms', String(ms)), 4 * DAY);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('main.review', { timeout: 120_000 });
await page.waitForFunction(
  () => /Đến hạn:\s*2|Due:\s*2/.test(document.querySelector('main.review')?.textContent ?? ''),
  null,
  { timeout: 60_000 },
);
log('debug clock +4d: both cards due again');

const parseDays = (s) => {
  const m = /([\d.]+)\s*(ngày|tháng|d|mo)/.exec(s ?? '');
  return m ? parseFloat(m[1]) * (m[2] === 'tháng' || m[2] === 'mo' ? 30 : 1) : null;
};
await page.click('button.start-all');
let glyphIvAfter = null;
for (let i = 0; i < 10; i++) {
  const done = await page.$('main.review h2');
  if (done && /Xong|complete/i.test(await done.textContent())) break;
  await page.waitForSelector('button.show-answer', { timeout: 15_000 });
  const front = await page.$eval('.review-hw', (e) => e.textContent.trim());
  await page.click('button.show-answer');
  await page.waitForSelector('button.rating-good', { timeout: 15_000 });
  const iv = await page.$eval('button.rating-good .iv', (e) => e.textContent);
  if (front === GLYPH) glyphIvAfter = iv;
  await page.click('button.rating-good');
  await page.waitForTimeout(180);
}
const before = parseDays(graduationIv);
const after = parseDays(glyphIvAfter);
log(`grapheme card interval: ${graduationIv} → ${glyphIvAfter}`);
if (before === null || after === null) fail(`could not parse intervals ${graduationIv} / ${glyphIvAfter}`);
if (!(after > before)) fail(`grapheme card interval did not advance: ${before}d → ${after}d`);
log(`ACCEPTANCE OK: FSRS scheduled the grapheme card (${before}d → ${after}d)`);

// --- 6b. import the backup back: a grapheme snapshot must pass validation ------------------
// second session also ended on the done screen — return to the overview for the backup panel
if (await page.$('main.review h2')) await page.click('main.review button.more').catch(() => {});
await page.waitForSelector('.backup input[type=file]', { state: 'attached', timeout: 60_000 });
await page.setInputFiles('.backup input[type=file]', backupPath);
await page.waitForFunction(
  () => /Đã phục hồi|Restore complete/.test(document.querySelector('main.review')?.textContent ?? ''),
  null,
  { timeout: 60_000 },
);
await page.waitForFunction(
  () => /Đến hạn:\s*2|Due:\s*2/.test(document.querySelector('main.review')?.textContent ?? ''),
  null,
  { timeout: 30_000 },
);
log('ACCEPTANCE OK: user.db with a grapheme card exports and re-imports (snapshot Zod accepted it)');

log(`\njs/console errors: ${errors.length}`);
for (const e of errors.slice(0, 10)) log(`   ! ${e}`);
await browser.close();
if (errors.length > 0) fail('console/page errors present');
console.log('\nRESULT: PASS — v0.3 P3 acceptance met');
