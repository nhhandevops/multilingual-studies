// v0.8 acceptance: "At 7 zh words/day you hit HSK-3 vocab ~Mar 2027, ~35 min/day."
//  1. the pack carries attested Sino-Vietnamese cognates — 大学=đại học, and NONE composed
//     (手机 must have no cognate: the reading-composition approach would have invented one)
//  2. the zh word page shows the cognate; a newly-added card FREEZES it and the review answer
//     renders it from the snapshot (invariant 6)
//  3. /stats shows known-vs-table bars whose denominators equal the pack's own level counts
//  4. the simulator is DETERMINISTIC (same inputs → same numbers) and FSRS-derived: its
//     steady/new ratio must land in the research band (~8-12×), not be hardcoded to it
//  5. the level-reach forecast responds to the slider and states a real month/year
//  6. nothing is fetched off-origin
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
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

// ---------------------------------------------------------------- 1. pack gates
const svTotal = pdb.prepare(`SELECT COUNT(*) n FROM words WHERE sv_cognate IS NOT NULL`).get().n;
const byLevel = pdb.prepare(`SELECT level, COUNT(*) t, SUM(sv_cognate IS NOT NULL) c FROM words
  WHERE lang='zh' AND level IS NOT NULL GROUP BY level ORDER BY level`).all();
log(`pack ${newest}: ${svTotal} zh words with an attested Sino-Vietnamese cognate`);
log(`  ${byLevel.map(r => `${r.level} ${r.c}/${r.t}`).join(' · ')}`);
if (svTotal < 5000) fail(`expected 5,000+ cognates, got ${svTotal}`);

const spot = Object.fromEntries(
  pdb.prepare(`SELECT headword, sv_cognate FROM words
    WHERE lang='zh' AND headword IN ('大学','注意','银行','政府','经济','手机','你好') AND level IS NOT NULL`)
    .all().map(r => [r.headword, r.sv_cognate]),
);
log(`  spot: 大学=${spot['大学']} 注意=${spot['注意']} 银行=${spot['银行']} | 手机=${spot['手机']} 你好=${spot['你好']}`);
if (spot['大学'] !== 'đại học') fail(`大学 must be đại học, got ${spot['大学']}`);
if (spot['注意'] !== 'chú ý') fail(`注意 must be chú ý, got ${spot['注意']}`);
if (spot['银行'] !== 'ngân hàng') fail(`银行 must be ngân hàng, got ${spot['银行']}`);
// The negative case is the design: no attested cognate → no cognate. A value here would mean
// composition sneaked back in ("thủ cơ" is a reading, not a word).
if (spot['手机'] != null) fail(`手机 must have NO cognate (composition would invent one), got ${spot['手机']}`);
if (spot['你好'] != null) fail(`你好 must have NO cognate, got ${spot['你好']}`);

// level table denominators, to compare against the dashboard's rendering
const zhLevels = pdb.prepare(`SELECT level, COUNT(*) n FROM words
  WHERE lang='zh' AND level IS NOT NULL GROUP BY level ORDER BY level`).all();
const hsk123 = zhLevels.filter(r => ['HSK1','HSK2','HSK3'].includes(r.level)).reduce((a, r) => a + r.n, 0);
log(`  zh level table: ${zhLevels.map(r => `${r.level} ${r.n}`).join(' · ')} (HSK1-3 cumulative ${hsk123})`);
pdb.close();

// ---------------------------------------------------------------- 2-6. browser
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [], off = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 140)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
// derived from BASE, not hardcoded: this script also runs against static-server on :5199
const originOk = new RegExp(`^(${BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|data:|blob:)`);
page.on('request', r => { if (!originOk.test(r.url())) off.push(r.url()); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input.searchbox', { timeout: 300000 });

// --- the cognate on the word page, and frozen into a card -----------------------------------
await page.fill('input.searchbox', '大学');
await page.waitForFunction(
  () => [...document.querySelectorAll('ul.words li .hw')].some(e => e.textContent === '大学'),
  null, { timeout: 30000 },
);
await page.click('ul.words li a:has(.hw:text-is("大学"))');
await page.waitForSelector('.sv-cognate', { timeout: 30000 });
const svLine = (await page.textContent('.sv-cognate')).trim();
log(`word page cognate line: "${svLine}"`);
if (svLine !== 'đại học') fail(`the word page must show đại học, got "${svLine}"`);

await page.click('.deck-btn.labeled:not(.in-deck)');
await page.waitForSelector('.deck-btn.labeled.in-deck', { timeout: 15000 });
log('added 大学 to the deck');

// review it: the answer must carry the cognate FROM THE SNAPSHOT
await page.click('nav a[href="/review"]');
await page.waitForFunction(
  () => [...document.querySelectorAll('.review-summary .card h3')].some(h => /Trung|Chinese/i.test(h.textContent)),
  null, { timeout: 30000 },
);
await page.click('.review-summary .card:has(h3:has-text("Trung")) button.more, .review-summary .card:has(h3:has-text("Chinese")) button.more');
await page.waitForSelector('.review-card .review-hw', { timeout: 30000 });
const prompt = (await page.textContent('.review-card .review-hw')).trim();
if (prompt !== '大学') fail(`expected the 大学 card, got "${prompt}"`);
await page.click('button.show-answer');
await page.waitForSelector('.review-answer .sv-cognate', { timeout: 15000 });
const answerSv = (await page.textContent('.review-answer .sv-cognate')).trim();
log(`review answer cognate (from snapshot): "${answerSv}"`);
if (answerSv !== 'đại học') fail('the review answer must render đại học from the snapshot');
await page.click('.rating-row button.rating-good');

// --- the dashboard --------------------------------------------------------------------------
await page.click('nav a[href="/stats"]');
await page.waitForSelector('.stats .level-row', { timeout: 60000 });
const zhRows = await page.$$eval('.lang-progress', els => {
  const zh = els.find(e => /Trung|Chinese/i.test(e.querySelector('h4')?.textContent ?? ''));
  return [...(zh?.querySelectorAll('.level-row') ?? [])].map(r => ({
    level: r.querySelector('.level-name')?.textContent.trim(),
    nums: r.querySelector('.level-nums')?.textContent.trim(),
  }));
});
log(`zh dashboard rows: ${zhRows.map(r => `${r.level} ${r.nums}`).join(' · ')}`);
if (zhRows.length !== zhLevels.length) fail(`dashboard shows ${zhRows.length} zh levels, pack has ${zhLevels.length}`);
for (const row of zhRows) {
  const packN = zhLevels.find(l => l.level === row.level)?.n;
  const denom = Number(row.nums.split('/')[1]);
  if (denom !== packN) fail(`dashboard denominator for ${row.level} is ${denom}, pack says ${packN}`);
}
// the card added a moment ago must be counted
const hsk1Row = zhRows.find(r => r.level === 'HSK1');
if (!hsk1Row || Number(hsk1Row.nums.split('/')[0]) < 1) fail('the just-added 大学 card is not counted under HSK1');
log('dashboard denominators equal the pack level table; the new card is counted');

// --- the simulator --------------------------------------------------------------------------
// set zh to exactly 7/day (the roadmap's example) and read the outputs
const setSlider = async (idx, value) => {
  await page.$$eval('.rate-row input[type="range"]', (els, args) => {
    const el = els[args.idx];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(args.value));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, { idx, value });
};
// The initial render (default budgets 5/5/5) already shows a positive number, so "any positive
// number" is a predicate that passes BEFORE the sliders take effect — this script's first run
// did exactly that and read 138 (= 3 langs × 5/day) as if it were the zh=7 figure. Capture the
// initial line and wait for it to CHANGE.
const initialLine = (await page.textContent('.forecast-out p')).replace(/\s+/g, ' ');
await setSlider(0, 7); //  zh is first
await setSlider(1, 0);
await setSlider(2, 0);
await page.waitForFunction(
  (initial) => {
    const line = (document.querySelector('.forecast-out p')?.textContent ?? '').replace(/\s+/g, ' ');
    return line !== initial && /(\d+)\s*(?:lượt ôn|reviews)/.test(line);
  },
  initialLine, { timeout: 30000 },
);
const loadLine = (await page.textContent('.forecast-out p')).replace(/\s+/g, ' ');
log(`load line at zh=7, others 0: ${loadLine.slice(0, 140)}`);
const reviews = Number(/(\d+)\s*(?:lượt ôn|reviews)/.exec(loadLine)?.[1]);
const minutes = Number(/(\d+)\s*(?:phút|min)/.exec(loadLine)?.[1]);
log(`parsed: ${reviews} reviews/day, ${minutes} min/day`);
// FSRS-derived, not hardcoded: the ratio must LAND in the research band
const ratio = reviews / 7;
if (ratio < 7 || ratio > 13) fail(`steady/new ratio ${ratio.toFixed(1)} is outside the plausible 7-13× band`);
if (!(minutes >= 10 && minutes <= 60)) fail(`minutes/day ${minutes} implausible for 7 new/day`);

// determinism: reload, set the same values, expect the same numbers. The wait is for the line
// to leave its INITIAL state first — the initial line also contains digits, and "includes the
// expected number" alone could match a coincidence in the pre-slider render.
await page.reload();
await page.waitForSelector('.rate-row input[type="range"]', { timeout: 60000 });
const initialLine2 = (await page.textContent('.forecast-out p')).replace(/\s+/g, ' ');
await setSlider(0, 7); await setSlider(1, 0); await setSlider(2, 0);
await page.waitForFunction(
  (initial) => (document.querySelector('.forecast-out p')?.textContent ?? '').replace(/\s+/g, ' ') !== initial,
  initialLine2, { timeout: 30000 },
);
const loadLine2 = (await page.textContent('.forecast-out p')).replace(/\s+/g, ' ');
const reviews2 = Number(/(\d+)\s*(?:lượt ôn|reviews)/.exec(loadLine2)?.[1]);
if (reviews2 !== reviews) fail(`the simulator gave ${reviews2} after a reload where it first gave ${reviews}`);
log('simulator is deterministic across reloads');

// the reach forecast names a real month for zh
const reach = (await page.textContent('.reach-list')).replace(/\s+/g, ' ');
log(`reach lines: ${reach.slice(0, 160)}`);
if (!/HSK\d/.test(reach)) fail('the forecast must name an HSK level');
if (!/20\d\d/.test(reach)) fail('the forecast must state a year');
// sanity: at 7/day, HSK1-3 minus the 1 known card ≈ (hsk123-1)/7 days out
const expectDays = Math.ceil((hsk123 - 1) / 7);
const expectDate = new Date(Date.now() + expectDays * 86400000);
const expectYear = String(expectDate.getFullYear());
if (!reach.includes(expectYear)) fail(`HSK3-reach year should be ~${expectYear} at 7/day (arithmetic check)`);
log(`HSK1-3 = ${hsk123} words → ~${expectDays} days at 7/day → year ${expectYear}: shown`);

// anchors carry the Vietnamese adjustment, in whichever UI language
const anchors = (await page.textContent('.anchors')).replace(/\s+/g, ' ');
if (!/2[.,]?200/.test(anchors)) fail('the FSI Mandarin anchor must be quoted');
if (!/trần|ceiling|upper bound/i.test(anchors)) fail('the Mandarin anchor must be framed as a ceiling for a Vietnamese speaker');
log('anchors quoted with the Vietnamese-adjustment framing');

log(`off-origin requests: ${off.length} | console errors: ${errors.length}`);
if (off.length) fail(`off-origin requests: ${off.slice(0, 3).join(', ')}`);
if (errors.length) fail(`console errors: ${errors.slice(0, 3).join(' | ')}`);

await browser.close();
console.log('\n✓ v0.8 acceptance passed');
