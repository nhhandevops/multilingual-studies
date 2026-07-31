// v0.3 P4c acceptance: IPA chart + sagittal diagrams.
//  1. /ipa lists all 51 diagrams grouped into the four categories
//  2. selecting a phone renders its diagram as an inert <img> (data: URL, not injected markup)
//  3. the image actually decodes (naturalWidth > 0) — a broken data URL would still "render"
//  4. apical/laminal variants that share one IPA symbol remain separate, selectable entries
//  5. everything offline; the CC0 source is credited on the Licenses screen
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
const phones = pdb.prepare(`SELECT glyph, notes_md, diagram_ref FROM graphemes WHERE lang='all' AND kind='ipa_phone' ORDER BY ord`).all();
const assets = pdb.prepare(`SELECT COUNT(*) n, SUM(length(bytes)) b FROM asset_blobs`).get();
pdb.close();
console.log(`pack ${newest}: ${phones.length} phones, ${assets.n} assets (${(assets.b/1024).toFixed(0)} KB)`);

const fail = (m) => { throw new Error(`ASSERT: ${m}`); };
const log = (m) => console.log(m);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await (await browser.newContext()).newPage();
const errors = [], offOrigin = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('request', (r) => { if (!/^(http:\/\/localhost:5173|data:|blob:)/.test(r.url())) offOrigin.push(r.url()); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input.searchbox', { timeout: 300_000 });
await page.click('header.top nav a[href="/ipa"]');
await page.waitForSelector('button.phone-btn', { timeout: 120_000 });

// --- 1. every diagram is present, grouped ---------------------------------------------------
const buttons = await page.$$eval('button.phone-btn', (bs) => bs.map((b) => ({ glyph: b.textContent.trim(), title: b.getAttribute('title') })));
const headings = await page.$$eval('.ipa-chart section h3', (hs) => hs.map((h) => h.textContent.trim()));
log(`categories: ${headings.slice(0, 4).join(' | ')}`);
log(`buttons: ${buttons.length} (pack has ${phones.length})`);
if (buttons.length !== phones.length) fail(`expected ${phones.length} phone buttons, got ${buttons.length}`);
if (headings.length < 5) fail(`expected 4 category sections + a diagram pane, got ${headings.length}`);

// --- 4. variants sharing a symbol stay distinct ---------------------------------------------
const apical = buttons.filter((b) => /apical/.test(b.title ?? ''));
const laminal = buttons.filter((b) => /laminal/.test(b.title ?? ''));
log(`variant entries: ${apical.length} apical, ${laminal.length} laminal (e.g. ${apical[0]?.glyph} “${apical[0]?.title}”)`);
if (apical.length < 4 || laminal.length < 3) fail(`apical/laminal variants collapsed (got ${apical.length}/${laminal.length}; upstream ships no ʒ_laminal)`);

// --- 2+3. selecting a phone renders a decodable inert image ---------------------------------
const checked = [];
for (const wanted of ['θ', 'ʁ', 'ɻ', 'i']) {
  const btn = await page.$(`button.phone-btn:has(.glyph:text-is("${wanted}"))`);
  if (!btn) fail(`phone ${wanted} not in the chart`);
  await btn.click();
  await page.waitForFunction(() => {
    const img = document.querySelector('.diagram img');
    return img && img.complete && img.naturalWidth > 0;
  }, null, { timeout: 20_000 });
  const info = await page.$eval('.diagram img', (img) => ({
    scheme: img.src.slice(0, 20), w: img.naturalWidth, h: img.naturalHeight, alt: img.alt,
  }));
  if (!info.scheme.startsWith('data:image/svg+xml')) fail(`diagram must be an inert data URL, got ${info.scheme}`);
  if (!(info.naturalWidth ?? info.w) > 0) fail(`diagram for ${wanted} did not decode`);
  checked.push(`${wanted} ${info.w}×${info.h} “${info.alt}”`);
}
log(`rendered: ${checked.join(' · ')}`);
// no raw SVG injected into the DOM
const inlineSvg = await page.$$eval('.diagram svg', (s) => s.length);
if (inlineSvg > 0) fail('diagrams must not be injected as markup');

// --- 5. credited on the Licenses screen -----------------------------------------------------
await page.click('header.top nav a[href="/licenses"]');
await page.waitForSelector('main .card', { timeout: 60_000 });
const lic = await page.$eval('main', (e) => e.textContent.replace(/\s+/g, ' '));
if (!/CC0 1\.0/.test(lic)) fail('CC0 source not credited on the Licenses screen');
if (!/Wright|McCloy/.test(lic)) fail('sagittal diagram authors not credited');
log('Licenses screen credits the CC0 diagram authors');

log(`off-origin requests: ${offOrigin.length}`);
if (offOrigin.length > 0) fail('IPA chart must stay offline');
log(`js/console errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) log(`   ! ${e}`);
await browser.close();
if (errors.length > 0) fail('console/page errors present');
console.log('\nRESULT: PASS — v0.3 P4c acceptance met (IPA chart + sagittal diagrams)');
