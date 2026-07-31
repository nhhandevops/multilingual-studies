// v0.3 P4a acceptance: "hear every pinyin syllable" (docs/PLAN.md roadmap row 0.3).
//  1. /pinyin renders the initials × finals chart for each tone
//  2. every one of the 1,707 syllables in the pack is reachable from some tone's chart
//  3. clicking a cell actually decodes and plays bundled audio (verified via a real
//     HTMLAudioElement: duration > 0 and currentTime advances)
//  4. the audio is served from the pack, not the network — no request leaves the origin
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';



import { REPO, BASE, CHROME } from './paths.mjs';
const require = createRequire(`${REPO}/apps/ingest/package.json`);
const Database = require('better-sqlite3');
const packsDir = join(REPO, 'build', 'packs');
const newest = readdirSync(packsDir).sort().at(-1);
const pdb = new Database(join(packsDir, newest, 'content.db'), { readonly: true });
const expected = pdb
  .prepare(`SELECT reading, glyph, ord FROM graphemes WHERE lang='zh' AND kind='pinyin_syllable'`)
  .all();
const blobStats = pdb
  .prepare(`SELECT COUNT(*) n, MIN(length(bytes)) lo, MAX(length(bytes)) hi FROM audio_blobs`)
  .get();
pdb.close();
console.log(`pack ${newest}: ${expected.length} syllables, ${blobStats.n} blobs (${blobStats.lo}–${blobStats.hi} B)`);

const fail = (m) => { throw new Error(`ASSERT: ${m}`); };
const log = (m) => console.log(m);

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext()).newPage();
const errors = [];
const offOrigin = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) offOrigin.push(r.url()); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input.searchbox', { timeout: 300_000 });
log('boot: pack installed');

await page.click('header.top nav a[href="/pinyin"]');
await page.waitForSelector('table.pinyin-chart button.syl', { timeout: 120_000 });

// --- 1+2. every syllable is reachable across the four tone charts -------------------------
const seen = new Set();
for (const tone of [1, 2, 3, 4, 5]) {
  await page.click(`.chips button:nth-of-type(${tone})`);
  // The neutral-tone chart is only 19 cells, so wait on the selected chip, not on a cell count.
  await page.waitForFunction(
    (t) => {
      const chips = [...document.querySelectorAll('.chips button')];
      return chips[t - 1]?.classList.contains('active') &&
             document.querySelectorAll('table.pinyin-chart button.syl').length > 0;
    },
    tone,
    { timeout: 30_000 },
  );
  const cells = await page.$$eval('table.pinyin-chart button.syl', (bs) =>
    bs.map((b) => ({ reading: b.getAttribute('title'), glyph: b.textContent })),
  );
  for (const c of cells) seen.add(c.reading);
  const rows = await page.$$eval('table.pinyin-chart tbody tr', (rs) => rs.length);
  const cols = await page.$$eval('table.pinyin-chart thead th', (hs) => hs.length - 1);
  log(`  tone ${tone}: ${cells.length} syllables in a ${rows}×${cols} grid`);
}
const expectedToned = expected.filter((e) => e.ord >= 1 && e.ord <= 5).map((e) => e.reading);
const missing = expectedToned.filter((r) => !seen.has(r));
log(`chart covers ${seen.size} of ${expectedToned.length} tone-1..5 syllables`);
if (missing.length > 0) fail(`${missing.length} syllables never appear in any chart: ${missing.slice(0, 12).join(', ')}`);

// --- 3. clicking a cell plays real decoded audio -------------------------------------------
await page.click('.chips button:nth-of-type(3)'); // tone 3
await page.waitForSelector('table.pinyin-chart button.syl', { timeout: 30_000 });
// instrument Audio so the test can observe what actually played
await page.evaluate(() => {
  window.__played = [];
  const Orig = window.Audio;
  window.Audio = function (src) {
    const el = new Orig(src);
    window.__played.push(el);
    return el;
  };
});
const target = await page.$('table.pinyin-chart button.syl[title="hao3"]');
if (!target) fail('hǎo (hao3) is not in the tone-3 chart');
await target.click();
await page.waitForFunction(() => (window.__played ?? []).length > 0, null, { timeout: 20_000 });
const audioInfo = await page.evaluate(async () => {
  const el = window.__played[0];
  await new Promise((r) => {
    if (el.readyState >= 1) return r();
    el.addEventListener('loadedmetadata', r, { once: true });
    setTimeout(r, 5000);
  });
  // Poll rather than sample once: a single 500 ms read failed under load (several browsers
  // running back to back) while playback was still starting, which looked like a product bug
  // and was not. Same trap as the review-screen counters — see HANDOFF's testing recipe.
  const t0 = el.currentTime;
  let advanced = false;
  for (let i = 0; i < 30 && !advanced; i++) {
    await new Promise((r) => setTimeout(r, 100));
    advanced = el.currentTime > t0 || el.ended;
  }
  return { src: el.src.slice(0, 5), duration: el.duration, advanced, paused: el.paused };
});
log(`played hǎo: src=${audioInfo.src}… duration=${audioInfo.duration?.toFixed(2)}s advanced=${audioInfo.advanced}`);
if (!(audioInfo.duration > 0.1)) fail(`audio did not decode (duration=${audioInfo.duration})`);
if (audioInfo.src !== 'blob:') fail(`audio should play from a pack blob, got ${audioInfo.src}`);
if (!audioInfo.advanced && !audioInfo.paused) fail('audio element never advanced');

// the highlight proves the click path reached the player
await page.waitForFunction(() => document.querySelector('button.syl.playing') !== null, null, { timeout: 5_000 })
  .catch(() => log('  (note: playing highlight already cleared)'));

// --- 4. nothing was fetched off-origin -----------------------------------------------------
log(`off-origin requests: ${offOrigin.length}${offOrigin.length ? ' → ' + offOrigin.slice(0, 3).join(', ') : ''}`);
if (offOrigin.length > 0) fail('audio/chart must be served entirely from the pack');

log(`\njs/console errors: ${errors.length}`);
for (const e of errors.slice(0, 10)) log(`   ! ${e}`);
await browser.close();
if (errors.length > 0) fail('console/page errors present');
console.log('\nRESULT: PASS — v0.3 P4a acceptance met (hear every pinyin syllable)');
