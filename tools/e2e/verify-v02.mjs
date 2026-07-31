// v0.2 acceptance test (PLAN "Verify" row):
//  1. add-to-deck from browse level lists
//  2. review session: new cards graduate through learning steps; daily stats + streak
//  3. FSRS intervals ADVANCE under a debug clock offset (the acceptance gate)
//  4. user.db export/import round-trips (restore rewinds state)
import { chromium } from 'playwright-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';


import { BASE, CHROME } from './paths.mjs';
const DAY = 864e5;

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
});
const ctx = await browser.newContext(); // fresh profile => fresh OPFS
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
page.on('dialog', (d) => void d.accept()); // import confirm()

const fail = (msg) => {
  throw new Error(`ASSERT: ${msg}`);
};
const log = (msg) => console.log(msg);

// --- boot + pack install -----------------------------------------------------
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input.searchbox', { timeout: 180_000 });
log('boot: pack installed, app ready');

// --- 1. add 3 zh HSK1 cards from browse --------------------------------------
await page.goto(`${BASE}/browse`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('ul.words li .deck-btn', { timeout: 30_000 });
for (let i = 0; i < 3; i++) {
  const btns = await page.$$('ul.words li .deck-btn:not(.in-deck)');
  if (!btns[0]) fail('no add button available');
  await btns[0].click();
  await page.waitForFunction((n) => document.querySelectorAll('.deck-btn.in-deck').length >= n, i + 1, {
    timeout: 15_000,
  });
}
const added = await page.$$eval('ul.words li', (ls) =>
  ls
    .filter((li) => li.querySelector('.deck-btn.in-deck'))
    .map((li) => li.querySelector('.hw')?.textContent ?? '?'),
);
log(`added to deck: ${added.join(', ')}`);
if (added.length !== 3) fail(`expected 3 in-deck rows, got ${added.length}`);

// --- 2. review overview + session --------------------------------------------
await page.goto(`${BASE}/review`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.review-summary .card', { timeout: 30_000 });
const overviewText = await page.$eval('main.review', (el) => el.textContent);
log(`overview: ${overviewText.replace(/\s+/g, ' ').slice(0, 200)}`);
if (!/Từ mới:\s*3|New:\s*3/.test(overviewText)) fail('overview should show 3 new available');

// run the whole session with "Good" (Nhớ). New cards pass 2 learning steps before graduating.
let goodIntervalAtGraduation = null;
await page.click('button.start-all');
for (let i = 0; i < 30; i++) {
  const done = await page.$('main.review h2');
  if (done && /Xong|complete/i.test(await done.textContent())) break;
  await page.waitForSelector('button.show-answer', { timeout: 15_000 });
  await page.click('button.show-answer');
  await page.waitForSelector('button.rating-good', { timeout: 15_000 });
  const iv = await page.$eval('button.rating-good .iv', (el) => el.textContent);
  if (/ngày|d\b/.test(iv)) goodIntervalAtGraduation = iv; // graduating step shows days
  await page.click('button.rating-good');
  await page.waitForTimeout(150);
}
// done phase flips before the stats refresh lands — poll for the final numbers
await page.waitForFunction(
  () => {
    const s = document.querySelector('main.review')?.textContent ?? '';
    return /3 từ mới|3 new/.test(s) && /3 lượt ôn|3 reviews/.test(s) && /1 ngày|1 days?/.test(s);
  },
  null,
  { timeout: 15_000 },
);
const doneText = await page.$eval('main.review', (el) => el.textContent.replace(/\s+/g, ' '));
log(`done screen: ${doneText.slice(0, 160)}`);
log(`graduation "Good" interval: ${goodIntervalAtGraduation}`);
if (!goodIntervalAtGraduation) fail('never saw a day-scale Good interval (graduation)');

// --- 3. export backup (state S1) ----------------------------------------------
await page.goto(`${BASE}/review`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.backup button', { timeout: 30_000 });
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 30_000 }),
  page.click('.backup button:first-of-type'),
]);
const backupPath = join(mkdtempSync(join(tmpdir(), 'mls-backup-')), 'user-backup.db');
await download.saveAs(backupPath);
log(`backup saved: ${backupPath}`);

// --- 4. debug clock +4d: cards come due, intervals must GROW -------------------
await page.evaluate((ms) => localStorage.setItem('mls_debug_clock_offset_ms', String(ms)), 4 * DAY);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('main.review', { timeout: 60_000 });
await page.waitForFunction(() => /⏱/.test(document.querySelector('main.review')?.textContent ?? ''), null, {
  timeout: 30_000,
});
await page.waitForFunction(
  () => /Đến hạn:\s*3|Due:\s*3/.test(document.querySelector('main.review')?.textContent ?? ''),
  null,
  { timeout: 30_000 },
);
log('debug clock +4d: 3 cards due again (badge shown)');

const parseDays = (s) => {
  const m = /([\d.]+)\s*(ngày|tháng|d|mo)/.exec(s ?? '');
  if (!m) return null;
  return parseFloat(m[1]) * (m[2] === 'tháng' || m[2] === 'mo' ? 30 : 1);
};
const gradDays = parseDays(goodIntervalAtGraduation);

await page.click('button.start-all');
let postOffsetIv = null;
for (let i = 0; i < 10; i++) {
  const done = await page.$('main.review h2');
  if (done && /Xong|complete/i.test(await done.textContent())) break;
  await page.waitForSelector('button.show-answer', { timeout: 15_000 });
  await page.click('button.show-answer');
  await page.waitForSelector('button.rating-good', { timeout: 15_000 });
  postOffsetIv = await page.$eval('button.rating-good .iv', (el) => el.textContent);
  await page.click('button.rating-good');
  await page.waitForTimeout(150);
}
log(`post-offset "Good" interval: ${postOffsetIv} (graduation was ${goodIntervalAtGraduation})`);
const postDays = parseDays(postOffsetIv);
if (postDays === null || gradDays === null) fail(`could not parse intervals: ${goodIntervalAtGraduation} / ${postOffsetIv}`);
if (!(postDays > gradDays)) fail(`FSRS interval did not advance: ${gradDays}d -> ${postDays}d`);
log(`ACCEPTANCE 1 OK: FSRS interval advanced under debug clock (${gradDays}d -> ${postDays}d)`);

// today (+4d) stats: 3 reviews, 0 new (poll — refresh is async after the phase flip)
await page.waitForFunction(
  () => {
    const s = document.querySelector('main.review')?.textContent ?? '';
    return (/0 từ mới|0 new/.test(s)) && (/3 lượt ôn|3 reviews/.test(s));
  },
  null,
  { timeout: 15_000 },
);

// --- 5. import backup: state must rewind to S1 --------------------------------
await page.goto(`${BASE}/review`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.backup button', { timeout: 30_000 });
await page.setInputFiles('.backup input[type=file]', backupPath);
await page.waitForFunction(
  () => /Đã phục hồi|Restore complete/.test(document.querySelector('main.review')?.textContent ?? ''),
  null,
  { timeout: 30_000 },
);
// restored daily_stats have no rows for the +4d date -> today's counters reset to 0·0,
// and the 3 cards (due at graduation times) are due again under the +4d clock
await page.waitForFunction(
  () => {
    const t = document.querySelector('main.review')?.textContent ?? '';
    return (/0 từ mới|0 new/.test(t) && /0 lượt ôn|0 reviews/.test(t)) && /Đến hạn:\s*3|Due:\s*3/.test(t);
  },
  null,
  { timeout: 30_000 },
);
log('ACCEPTANCE 2 OK: import rewound state (today 0·0, 3 due from restored schedule)');

// --- 6. bad-file import must be rejected and change nothing --------------------
const badPath = join(mkdtempSync(join(tmpdir(), 'mls-bad-')), 'not-a-db.db');
const { writeFileSync } = await import('node:fs');
writeFileSync(badPath, 'this is definitely not sqlite');
await page.setInputFiles('.backup input[type=file]', badPath);
await page.waitForFunction(
  () => /Không phục hồi được|Restore failed/.test(document.querySelector('main.review')?.textContent ?? ''),
  null,
  { timeout: 30_000 },
);
const after = await page.$eval('main.review', (el) => el.textContent.replace(/\s+/g, ' '));
if (!/Đến hạn:\s*3|Due:\s*3/.test(after)) fail('bad import must leave state unchanged');
log('bad-file import rejected, state unchanged');

// --- wrap-up -------------------------------------------------------------------
log(`\njs/console errors: ${errors.length}`);
for (const e of errors.slice(0, 10)) log(`   ! ${e}`);
await browser.close();
if (errors.length > 0) fail('console/page errors present');
console.log('\nRESULT: PASS — v0.2 acceptance criteria met');
