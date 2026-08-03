// UX acceptance: the four defects a user reported, and the three worse ones under them.
//
//  1. NAVIGATION — the current tab is lit (class + aria-current), a nested route keeps its
//     parent lit, and the page NEVER scrolls sideways at phone widths (it used to overflow
//     219px at 390px with the last four tabs unreachable).
//  2. GUIDANCE — every screen opens with exactly one `.screen-intro` sentence, in both UI
//     languages, and none of them is a raw i18n key.
//  3. LOADING TRUTHFULNESS — no screen states "there is no data" before its first query has
//     answered. Asserted with a SEEDED deck, because with an empty deck "Bộ thẻ đang trống" is
//     simply true and the assertion would pass on the starting state.
//  4. IPA CHIPS — no chip overflows its box, no two chips overlap, and no two chips are
//     indistinguishable (six glyphs are duplicated across 13 buttons).
//  5. i18n PARITY — vi.json and en.json hold the same key set. Nothing else in the suite checks
//     this, and a key present in one file only ships the literal key text to the other language
//     while every other script still passes.
//
// Run:  pnpm dev   (or the static server), then
//       node verify-ux.mjs
//       MLS_BASE=http://localhost:5199 node verify-ux.mjs
//
// Nav clicks, never page.goto once loaded (README: a fresh document can lose the OPFS handles),
// and href$= suffix selectors so this also runs against the deployed base path.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, BASE, CHROME } from './paths.mjs';

const fail = (m) => { throw new Error(`ASSERT: ${m}`); };
const log = (m) => console.log(m);

// ------------------------------------------------------------------ 5. i18n parity (no browser)
const i18nDir = join(REPO, 'apps', 'web', 'src', 'i18n');
const flat = (o, prefix = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
const viKeys = new Set(flat(JSON.parse(readFileSync(join(i18nDir, 'vi.json'), 'utf8'))));
const enKeys = new Set(flat(JSON.parse(readFileSync(join(i18nDir, 'en.json'), 'utf8'))));
const onlyVi = [...viKeys].filter((k) => !enKeys.has(k));
const onlyEn = [...enKeys].filter((k) => !viKeys.has(k));
if (onlyVi.length || onlyEn.length)
  fail(`i18n key sets differ — vi-only: [${onlyVi.join(', ')}] en-only: [${onlyEn.join(', ')}]`);
log(`i18n parity ok: ${viKeys.size} keys in both files`);

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
// `footer.pack`, not `nav a`: the header renders OUTSIDE the `state === 'ready'` gate, so the
// tabs exist while the pack is still downloading. Waiting on them passes instantly on a warm
// profile and then clicks into routes that are not mounted yet on a cold one — which is exactly
// how this script first failed against the live site's 56 MB first visit.
await page.waitForSelector('header.top nav a', { timeout: 600_000 });
await page.waitForSelector('footer.pack', { timeout: 900_000 });
log('app booted and the pack is installed');

const activeTab = () =>
  page.$$eval('header.top nav a', (as) => {
    const a = as.find((x) => x.classList.contains('active'));
    return a ? { href: a.getAttribute('href'), aria: a.getAttribute('aria-current'), text: a.textContent.trim() } : null;
  });
const goTab = async (path, ready) => {
  await page.click(`header.top nav a[href$="${path}"]`);
  if (ready) await page.waitForSelector(ready, { timeout: 120_000 });
};

// ------------------------------------------------------------------ 1. navigation
const TABS = [
  ['/today', '.today'],
  ['/browse', 'ul.words li'],
  ['/write', '.glyph-grid li'],
  ['/ipa', 'button.phone-btn'],
  ['/grammar', '.grammar-list li'],
  ['/tech', '.tech-list li'],
  ['/stats', 'main.stats'],
  ['/licenses', 'main'],
];
for (const [path, ready] of TABS) {
  await goTab(path, ready);
  const a = await activeTab();
  if (!a || !a.href.endsWith(path)) fail(`${path}: active tab is ${a ? a.href : 'NONE'}`);
  if (a.aria !== 'page') fail(`${path}: active tab has aria-current=${a.aria}`);
}
log(`nav: all ${TABS.length} tabs light themselves with aria-current=page`);

// a nested route keeps its PARENT tab lit — this is why the NavLinks carry no `end` prop
await goTab('/grammar', '.grammar-list li a');
await page.click('.grammar-list li a');
await page.waitForSelector('.grammar-detail', { timeout: 60_000 });
let a = await activeTab();
if (!a || !a.href.endsWith('/grammar')) fail(`/grammar/:id lost its parent tab (got ${a ? a.href : 'NONE'})`);

// /word/:id lights Search AND keeps aria-current — the whole reason it stays a <Link>
await goTab('/browse', 'ul.words li a');
await page.click('ul.words li a');
await page.waitForFunction(() => location.pathname.includes('/word/'), null, { timeout: 60_000 });
a = await activeTab();
if (!a || !/\/$/.test(a.href)) fail(`/word/:id should light the search tab, got ${a ? a.href : 'NONE'}`);
if (a.aria !== 'page') fail('/word/:id: search tab is styled active but drops aria-current');
log('nav: nested routes keep their parent tab lit, /word/:id lights search with aria-current');

// the page must never scroll sideways, and the lit tab must be reachable
for (const w of [360, 390, 430, 780, 1280]) {
  await page.setViewportSize({ width: w, height: 800 });
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 0) fail(`page scrolls sideways by ${over}px at ${w}px wide`);
}
await page.setViewportSize({ width: 390, height: 800 });
await goTab('/licenses', 'main');
await page.waitForTimeout(250);
const lastVisible = await page.evaluate(() => {
  const nav = document.querySelector('header.top nav');
  const el = nav.querySelector('a.active');
  if (!el) return false;
  const r = el.getBoundingClientRect(), n = nav.getBoundingClientRect();
  return r.left >= n.left - 1 && r.right <= n.right + 1;
});
if (!lastVisible) fail('the last tab is lit but scrolled out of view at 390px');
log('nav: 0px page overflow at 360/390/430/780/1280, and the lit tab is scrolled into view');
await page.setViewportSize({ width: 1280, height: 900 });

// ------------------------------------------------------------------ 2. guidance
const KEY_LIKE = /^[a-z]+\.[a-zA-Z]+$/; //  an untranslated key renders as its own name
for (const lang of ['vi', 'en']) {
  await page.click(`.ui-lang button:nth-of-type(${lang === 'vi' ? 1 : 2})`);
  await page.waitForTimeout(120);
  for (const [path, ready] of TABS) {
    await goTab(path, ready);
    const intros = await page.$$eval('main .screen-intro', (ps) => ps.map((p) => p.textContent.trim()));
    if (intros.length !== 1) fail(`${path} [${lang}]: expected exactly one .screen-intro, found ${intros.length}`);
    if (!intros[0]) fail(`${path} [${lang}]: the intro line is empty`);
    if (KEY_LIKE.test(intros[0])) fail(`${path} [${lang}]: intro rendered a raw i18n key — "${intros[0]}"`);
  }
  log(`guidance: every screen opens with one real sentence [${lang}]`);
}
await page.click('.ui-lang button:nth-of-type(1)'); //  back to Vietnamese

// ------------------------------------------------------------------ 3. loading truthfulness
// Seed the deck FIRST: with an empty deck "Bộ thẻ đang trống" is true, and an assertion that
// passes on the starting state is a stub kinder than the real thing.
await goTab('/browse', '.deck-btn');
if ((await page.$$eval('.deck-btn.in-deck', (b) => b.length)) === 0) {
  await page.click('.deck-btn:not(.in-deck)');
  await page.waitForSelector('.deck-btn.in-deck', { timeout: 30_000 });
}

// Sample as fast as the round trips allow, bounded by wall time — a fixed iteration count is a
// disguised timeout, and these queries run over a 163 MB DB in a worker.
const SETTLE_MS = 90_000;
const watchUntilSettled = async (label, pattern, settled) => {
  const deadline = Date.now() + SETTLE_MS;
  while (Date.now() < deadline) {
    const txt = await page.textContent('main').catch(() => '');
    if (pattern.test(txt))
      fail(`${label} claimed "no data" while still loading — "${txt.replace(/\s+/g, ' ').slice(0, 120)}"`);
    if (await page.$(settled)) return;
  }
  fail(`${label} never settled within ${SETTLE_MS / 1000}s`);
};
const mustNotFlash = async (path, pattern, settled) => {
  await page.click(`header.top nav a[href$="${path}"]`);
  await watchUntilSettled(path, pattern, settled);
};
await mustNotFlash('/review', /Bộ thẻ đang trống|deck is empty/i, '.review-summary, .queue-summary, button.start-all');
await mustNotFlash('/write', /Không có chữ nào|No characters/i, '.glyph-grid li');
// switching a filter must go back to loading, not show the previous answer's empty state
await page.click('.chips.levels button:nth-of-type(4)');
await watchUntilSettled('/write (filter switch)', /Không có chữ nào|No characters/i, '.glyph-grid li');
log('loading: no screen claims "no data" before its query answers (deck was seeded first)');

// ------------------------------------------------------------------ 4. IPA chips
await goTab('/ipa', 'button.phone-btn');
for (const w of [360, 390, 780, 1280]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(120);
  const r = await page.$$eval('button.phone-btn', (bs) => {
    const over = bs.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent.trim());
    const boxes = bs.map((b) => b.getBoundingClientRect());
    let overlaps = 0;
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const x = boxes[i], y = boxes[j];
        if (x.right > y.left + 1 && y.right > x.left + 1 && x.bottom > y.top + 1 && y.bottom > x.top + 1) overlaps++;
      }
    return { n: bs.length, over, overlaps };
  });
  if (r.over.length) fail(`IPA chips overflow at ${w}px: ${r.over.join(', ')}`);
  if (r.overlaps) fail(`${r.overlaps} IPA chips overlap at ${w}px`);
}
await page.setViewportSize({ width: 1280, height: 900 });
const labels = await page.$$eval('button.phone-btn', (bs) => bs.map((b) => b.textContent.replace(/\s+/g, ' ').trim()));
const dupes = [...new Set(labels.filter((l, i) => labels.indexOf(l) !== i))];
if (dupes.length) fail(`IPA chips are indistinguishable: ${dupes.join(', ')}`);
// aria-label belongs on captioned chips only — on a word chip it would replace the visible
// Vietnamese with raw English (WCAG 2.5.3).
const ariaMismatch = await page.$$eval('button.phone-btn', (bs) =>
  bs.filter((b) => !!b.querySelector('.phone-tag') !== !!b.getAttribute('aria-label')).length);
if (ariaMismatch) fail(`${ariaMismatch} IPA chips have aria-label without a caption, or the reverse`);
log(`ipa: ${labels.length} chips, all distinct, none overflowing or overlapping in any width`);

// ------------------------------------------------------------------ hygiene
// mls-pool contention is the documented v0.9 OPFS handover across full-document navigation.
const real = consoleErrors.filter((e) => !e.includes('mls-pool'));
if (real.length) fail(`console errors:\n  ${real.slice(0, 8).join('\n  ')}`);

await browser.close();
log('\nverify-ux: PASS');
