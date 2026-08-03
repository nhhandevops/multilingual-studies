// v1.0 acceptance, the deploy half: the app is really served from GitHub Pages.
//
// Everything the local suite proves runs at base path '/'. This script proves the parts
// that only exist on the deployed project site (base /multilingual-studies/):
//  1. /packs/manifest.json is served next to the shell, is valid JSON, and both pack
//     files answer 200 (the workflow's release-download step actually shipped them)
//  2. a DEEP LINK (/stats) on a FIRST visit — no service worker yet — boots through
//     Pages' 404.html fallback, the router resolves the route under the non-root base,
//     and the pack installs into OPFS along the way
//  3. after a reload the service worker controls the page
//  4. zero requests leave the site's own origin
//  5. console hygiene, scoped honestly: the deep-link document itself arrives with
//     HTTP 404 (that is HOW Pages serves a SPA fallback — the app works, the browser
//     still logs it), and full-document navigation hands the OPFS pool between
//     documents, which logs mls-pool contention while the v0.9 guarded self-reload
//     recovers (HANDOFF v0.9: the outgoing document holds the handles ~20 s). Those
//     two KNOWN classes are allowed; any other console error fails the run.
//
// One page, start to finish — the app's single-tab model. A second tab would get the
// storage-locked screen BY DESIGN, so a test that opens one tests its own scenario.
//
// Run:  node verify-v10-live.mjs
//       MLS_LIVE=https://user.github.io/repo node verify-v10-live.mjs   (other deploys)
//
// The pack download is ~56 MB from the live site, so the install wait is generous.
import { chromium } from 'playwright-core';
import { CHROME } from './paths.mjs';

const LIVE = (process.env.MLS_LIVE ?? 'https://nhhandevops.github.io/multilingual-studies').replace(/\/$/, '');
const ORIGIN = new URL(LIVE).origin;
const DEEP = `${LIVE}/stats`;

const fail = (m) => { throw new Error(`ASSERT: ${m}`); };
const log = (m) => console.log(m);

async function waitFor(page, selector, timeout = 60_000, note = '') {
  try {
    await page.waitForSelector(selector, { timeout });
  } catch {
    const body = await page.textContent('body').catch(() => '(no body)');
    fail(`${note || selector} never appeared (${page.url()})\n  page said: ${body.replace(/\s+/g, ' ').slice(0, 300)}`);
  }
}

// ------------------------------------------------------------------ 1. served artifacts
log(`live site: ${LIVE}`);
const mRes = await fetch(`${LIVE}/packs/manifest.json`);
if (!mRes.ok) fail(`packs/manifest.json → HTTP ${mRes.status}`);
const manifest = await mRes.json();
if (!manifest.packVersion) fail('manifest has no packVersion');
if (!manifest.media?.file) fail('manifest has no media object — pre-split pack deployed?');
log(`  manifest ok: pack ${manifest.packVersion}, media ${manifest.media.file}`);

for (const f of ['content.pack', manifest.media.file]) {
  const res = await fetch(`${LIVE}/packs/${f}`, { method: 'HEAD' });
  if (!res.ok) fail(`packs/${f} → HTTP ${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len < 10_000_000) fail(`packs/${f} is ${len} bytes — a fallback page, not a pack`);
  log(`  ${f} ok: ${(len / 1024 / 1024).toFixed(1)} MB`);
}

const wmRes = await fetch(`${LIVE}/manifest.webmanifest`);
if (!wmRes.ok) fail(`manifest.webmanifest → HTTP ${wmRes.status}`);
const webman = await wmRes.json();
if (!webman.icons?.some((i) => i.sizes === '512x512')) fail('webmanifest has no 512px icon');

// ------------------------------------------------------------------ 2. deep link, first visit
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const consoleErrors = []; //  {text, url}
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), url: msg.location()?.url ?? '' });
});
const offOrigin = [];
page.on('request', (req) => {
  const u = new URL(req.url());
  if (u.origin !== ORIGIN && u.protocol !== 'blob:' && u.protocol !== 'data:') offOrigin.push(req.url());
});

log('deep-linking to /stats on a first visit (no SW yet; installs the ~56 MB pack)…');
await page.goto(DEEP, { waitUntil: 'domcontentloaded' });
await waitFor(page, 'main.stats', 600_000, 'stats screen from a cold deep link');
const bars = await page.locator('.level-row').count();
if (bars < 5) fail(`stats deep link rendered only ${bars} level rows`);
log(`  deep link ok: 404.html fallback boots the app, router resolves /stats, ${bars} level bars`);

// ------------------------------------------------------------------ 3. SW controls the page
await page.reload({ waitUntil: 'domcontentloaded' });
await waitFor(page, 'main.stats', 120_000, 'stats after reload');
const controlled = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  await navigator.serviceWorker.ready;
  return navigator.serviceWorker.controller ? 'controlled' : 'uncontrolled';
});
if (controlled !== 'controlled') fail(`service worker state after reload: ${controlled}`);
log('  service worker controls the page');

// ------------------------------------------------------------------ 4. hygiene
if (offOrigin.length) fail(`off-origin requests:\n  ${[...new Set(offOrigin)].join('\n  ')}`);

// The two known-benign classes (see header); anything else is a real error.
const unexplained = consoleErrors.filter(({ text, url }) => {
  if (text.includes('mls-pool')) return false; //  pool handover during full-document nav
  if (/status of 404/.test(text) && url.replace(/\/$/, '') === DEEP) return false; //  Pages SPA fallback
  return true;
});
if (unexplained.length)
  fail(`unexplained console errors:\n  ${unexplained.map((e) => `${e.text} (${e.url})`).join('\n  ')}`);
log(`  0 off-origin requests, 0 unexplained console errors (${consoleErrors.length} known-benign)`);

await browser.close();
log(`\nverify-v10-live: PASS (${LIVE}, pack ${manifest.packVersion})`);
