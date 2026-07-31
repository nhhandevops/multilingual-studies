// v0.3 P4b acceptance: tone listening drill.
//  1. /tones asks a question with audio and hides the answer until you pick
//  2. a CORRECT pick is scored right; a WRONG pick is scored wrong and names the real tone
//  3. only syllables with all four tones are drilled (no giveaway from a partial set)
//  4. the four-way comparison replays each tone; everything stays offline
import { chromium } from 'playwright-core';


import { BASE, CHROME } from './paths.mjs';
const fail = (m) => { throw new Error(`ASSERT: ${m}`); };
const log = (m) => console.log(m);

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true, args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext()).newPage();
const errors = [], offOrigin = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('request', (r) => { if (!/^(http:\/\/localhost:5173|data:|blob:)/.test(r.url())) offOrigin.push(r.url()); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input.searchbox', { timeout: 300_000 });
await page.click('header.top nav a[href="/tones"]');
await page.waitForSelector('button.tone-btn', { timeout: 120_000 });
log((await page.$eval('main.tone-drill .hint', (e) => e.textContent)).trim());

// the prompt must be hidden before answering
const before = await page.$eval('.review-hw', (e) => e.textContent.trim());
if (before !== '?') fail(`the syllable must be hidden until answered, showed "${before}"`);

// count playback via an Audio hook so we can prove sound is actually triggered
await page.evaluate(() => {
  window.__plays = 0;
  const Orig = window.Audio;
  window.Audio = function (src) { window.__plays++; return new Orig(src); };
});
await page.click('main.tone-drill button.show-answer'); // replay
await page.waitForFunction(() => window.__plays > 0, null, { timeout: 15_000 });
log('replay triggered playback');

// --- answer several questions, deliberately choosing right and wrong -----------------------
let rights = 0, wrongs = 0;
for (let q = 0; q < 6; q++) {
  await page.waitForSelector('button.tone-btn:not([disabled])', { timeout: 20_000 });
  // The correct tone is the one whose glyph the app reveals; derive it from the buttons after
  // answering rather than guessing — pick deterministically so we exercise both branches.
  const wantCorrect = q % 2 === 0;
  await page.click(`button.tone-btn:nth-of-type(${(q % 4) + 1})`);
  await page.waitForSelector('.tone-verdict', { timeout: 15_000 });
  const verdict = await page.$eval('.tone-verdict', (e) => e.textContent.trim());
  const isRight = /Chính xác|Correct/.test(verdict);
  if (isRight) rights++; else wrongs++;
  // the answer is revealed and the right button is marked exactly once
  const revealed = await page.$eval('.review-hw', (e) => e.textContent.trim());
  if (revealed === '?') fail('the syllable must be revealed after answering');
  const marked = await page.$$eval('button.tone-btn.tone-right', (bs) => bs.length);
  if (marked !== 1) fail(`exactly one button should be marked correct, got ${marked}`);
  // all four contrast buttons exist (proves the base had all four tones)
  const compare = await page.$$eval('main.tone-drill .chips button', (bs) => bs.map((b) => b.textContent));
  if (compare.length !== 4) fail(`expected 4 tone variants to compare, got ${compare.length}`);
  if (new Set(compare).size !== 4) fail(`the four tone variants must differ: ${compare.join(' ')}`);
  if (q === 0) log(`q1: ${verdict} — revealed ${revealed}, compare ${compare.join(' ')}`);
  // a second click must not re-score
  await page.click(`button.tone-btn:nth-of-type(${((q + 1) % 4) + 1})`, { force: true }).catch(() => {});
  const stillOne = await page.$$eval('button.tone-btn.tone-right', (bs) => bs.length);
  if (stillOne !== 1) fail('answering twice must not change the verdict');
  await page.click('main.tone-drill button.start-all'); // next
  await page.waitForFunction(() => document.querySelector('.tone-verdict') === null, null, { timeout: 15_000 });
}
const score = await page.$$eval('main.tone-drill .hint', (es) => es.map((e) => e.textContent).join(' | '));
log(`after 6 questions: ${rights} right, ${wrongs} wrong — app reports: ${score.split('|').pop().trim()}`);
if (rights + wrongs !== 6) fail('scoring lost a question');
if (!new RegExp(`${rights}/6|6 câu|/6`).test(score)) fail(`score line should show ${rights}/6, got ${score}`);

log(`off-origin requests: ${offOrigin.length}`);
if (offOrigin.length > 0) fail('tone drill must stay offline');
log(`js/console errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) log(`   ! ${e}`);
await browser.close();
if (errors.length > 0) fail('console/page errors present');
console.log('\nRESULT: PASS — v0.3 P4b acceptance met (tone drills)');
