// v0.5 P1+P2 acceptance: "Read HSK-2 的/得/地 offline; Tex's grammar with audio."
//  1. the pack carries the official HSK grammar syllabus, graded, and Tex's grammar in full
//  2. every topic's source is registered, and NO link-only source ships body text
//  3. /grammar browses by language and level; a Chinese point opens and shows its outbound link
//  4. the level-2 得 point — the acceptance target — is reachable and readable offline
//  5. a French topic renders real prose and plays its bundled recorded example from the pack
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

// ---------------------------------------------------------------- pack-level gates
const byLang = pdb.prepare('SELECT lang, COUNT(*) n FROM grammar_topics GROUP BY lang ORDER BY lang').all();
const zhLevels = pdb.prepare(`SELECT level, COUNT(*) n FROM grammar_topics WHERE lang='zh' GROUP BY level ORDER BY level`).all();
const orphan = pdb.prepare(`SELECT COUNT(*) n FROM grammar_topics g
  WHERE NOT EXISTS (SELECT 1 FROM sources s WHERE s.id = g.source_id)`).get().n;
// the gate that matters most: a NonCommercial source may be linked, never bundled
const ncBody = pdb.prepare(`SELECT COUNT(*) n FROM grammar_topics g JOIN sources s ON s.id=g.source_id
  WHERE s.license_mode='link-only' AND g.body_md IS NOT NULL`).get().n;
const noTitle = pdb.prepare(`SELECT COUNT(*) n FROM grammar_topics WHERE title_en IS NULL OR title_en=''`).get().n;

log(`pack ${newest}: ${byLang.map(r => `${r.lang} ${r.n}`).join(' · ')}`);
log(`zh levels: ${zhLevels.map(r => `${r.level} ${r.n}`).join(' · ')}`);
log(`orphan-source rows: ${orphan} | link-only rows carrying body text: ${ncBody} | rows with no title: ${noTitle}`);
if (byLang.length === 0) fail('pack carries no grammar at all');
if (orphan !== 0) fail('every grammar topic must come from a registered source');
if (ncBody !== 0) fail('a link-only (NonCommercial) source must never ship body text');
if (noTitle !== 0) fail('grammar topics must have a title');
if (zhLevels.length < 7) fail(`expected the full HSK1..HSK7-9 grading, got ${zhLevels.length} levels`);

// the acceptance target: the level-2 structural particle 得
const de = pdb.prepare(`SELECT id, title_en, level, body_md, external_links FROM grammar_topics
  WHERE lang='zh' AND level='HSK2' AND title_en LIKE '%得%' LIMIT 1`).get();
if (!de) fail('the HSK-2 得 grammar point is missing');
log(`acceptance target: ${de.level} "${de.title_en}" (${de.id})`);
if (!de.body_md) fail('得 must be readable offline, not an empty stub');

// The link must RESOLVE, not merely exist. An earlier version of this seed pointed every point
// at a search URL; 14 of 16 sampled points landed on "There were no results" and this script
// still passed, because it only checked that an <a> was present. Checking existence is not
// checking correctness.
const deLinks = JSON.parse(de.external_links ?? '[]');
if (deLinks.length === 0) fail('得 should link out to the Grammar Wiki');
const probe = await fetch(deLinks[0].url, {
  headers: { 'user-agent': 'Mozilla/5.0 (compatible; multilingual-studies-e2e)' },
  redirect: 'follow',
});
const probeBody = await probe.text();
const dead = /There were no results|does not exist|noarticletext/i.test(probeBody);
log(`得 outbound link → HTTP ${probe.status}${dead ? ' [NO ARTICLE]' : ' (real article)'}  ${deLinks[0].url}`);
if (!probe.ok || dead) fail(`the Grammar Wiki link for 得 does not resolve: ${deLinks[0].url}`);

// And no stored link may be a search URL — that was the broken shape.
const searchy = pdb.prepare(`SELECT COUNT(*) n FROM grammar_topics
  WHERE external_links LIKE '%index.php?search=%'`).get().n;
if (searchy !== 0) fail(`${searchy} topics still link to a search URL instead of an article`);

// a French topic with a bundled recorded example
const fr = pdb.prepare(`SELECT g.id, g.title_en, g.body_md, g.external_links FROM grammar_topics g
  WHERE g.lang='fr' AND g.external_links LIKE '%audio:%' ORDER BY g.ord LIMIT 1`).get();
if (!fr) fail('no French grammar topic carries a bundled recording');
const frAudioId = JSON.parse(fr.external_links).find(l => l.url.startsWith('audio:')).url.slice(6);
const blob = pdb.prepare('SELECT LENGTH(bytes) n FROM audio_blobs WHERE audio_id=?').get(frAudioId);
log(`french target: "${fr.title_en}" (${fr.body_md.length} chars) + clip ${frAudioId} (${blob ? blob.n : 0} B)`);
if (!blob || blob.n < 1000) fail('the French grammar clip has no bundled audio blob');
const frCredit = pdb.prepare('SELECT attribution, license FROM audio WHERE id=?').get(frAudioId);
if (!/CC BY/.test(frCredit.license)) fail(`Tex audio must carry its CC BY license, got ${frCredit.license}`);
pdb.close();

// ---------------------------------------------------------------- browser
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [], off = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 140)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
page.on('request', r => { if (!/^(http:\/\/localhost:5173|data:|blob:)/.test(r.url())) off.push(r.url()); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input.searchbox', { timeout: 300000 });
await page.click('nav a[href="/grammar"]');
await page.waitForSelector('.grammar-index .grammar-list li', { timeout: 60000 });
const langChips = await page.$$eval('.chips.langs button', els => els.map(e => e.textContent.trim()));
log(`/grammar language chips: ${langChips.join(' | ')}`);
if (langChips.length < 2) fail('expected a chip per language that has grammar');

// --- 1. Chinese: filter to HSK2 and open the 得 point ---------------------------------------
// The UI is Vietnamese-first, so match its label ("Tiếng Trung"), not the character 中. Chips
// are alphabetical, so French — which has no CEFR levels and therefore no level chips — is
// selected first; picking the wrong chip here waits forever for level chips that never come.
await page.click('.chips.langs button:has-text("Trung"), .chips.langs button:has-text("Chinese")');
await page.waitForSelector('.chips.levels button', { timeout: 30000 });
await page.click('.chips.levels button:has-text("HSK2")');
await page.waitForFunction(
  () => [...document.querySelectorAll('.grammar-list .badge')].some(b => b.textContent.trim() === 'HSK2'),
  null, { timeout: 30000 });
const hsk2 = await page.$$eval('.grammar-list li', els => els.map(e => e.textContent));
log(`HSK2 list: ${hsk2.length} points`);
const deLink = await page.$(`.grammar-list li a:has-text("得")`);
if (!deLink) fail('the 得 point is not listed under HSK2');
await deLink.click();
await page.waitForSelector('.grammar-detail', { timeout: 30000 });
const deText = await page.textContent('.grammar-detail');
log(`得 page renders ${deText.replace(/\s+/g, ' ').trim().slice(0, 90)}…`);
if (!deText.includes('得')) fail('the 得 page does not show the grammar point');
const readMore = await page.$$eval('.grammar-detail a[href^="http"]', els => els.map(e => e.href));
log(`outbound links: ${readMore.filter(h => h.includes('allsetlearning')).length} to the Grammar Wiki (NC → link, never bundled)`);
if (!readMore.some(h => h.includes('allsetlearning'))) fail('the Chinese point should link out to the Grammar Wiki');

// --- 2. French: real prose + the bundled recording -------------------------------------------
await page.click('nav a[href="/grammar"]');
await page.waitForSelector('.chips.langs button', { timeout: 30000 });
await page.click('.chips.langs button:has-text("Pháp"), .chips.langs button:has-text("French")');
await page.waitForFunction(() => document.querySelectorAll('.grammar-list li').length > 50, null, { timeout: 30000 });
await page.click(`.grammar-list li a:has-text("${fr.title_en}")`);
await page.waitForSelector('.grammar-detail .md', { timeout: 30000 });
const paras = await page.$$eval('.grammar-detail .md p, .grammar-detail .md li', els => els.length);
const bold = await page.$$eval('.grammar-detail .md strong', els => els.length);
log(`french page: ${paras} blocks, ${bold} emphasised spans`);
if (paras < 3) fail('the French grammar page rendered almost no prose');
if (bold === 0) fail('markdown emphasis did not render (the example highlighting is the teaching signal)');
const rawStars = await page.$$eval('.grammar-detail .md', els => els.map(e => e.textContent).join(''));
if (rawStars.includes('**')) fail('literal ** left in the rendered text — markdown was not parsed');

await page.evaluate(() => {
  window.__played = [];
  const O = window.Audio;
  window.Audio = function (src) { const el = new O(src); window.__played.push(el); return el; };
});
await page.click('.grammar-detail button.speak');
await page.waitForFunction(() => (window.__played ?? []).length > 0, null, { timeout: 20000 });
const info = await page.evaluate(async () => {
  const el = window.__played[0];
  await new Promise(r => { if (el.readyState >= 1) return r(); el.addEventListener('loadedmetadata', r, { once: true }); setTimeout(r, 5000); });
  return { scheme: el.src.slice(0, 5), duration: el.duration };
});
log(`played Tex example: src=${info.scheme}… duration=${info.duration?.toFixed(2)}s`);
if (info.scheme !== 'blob:') fail(`grammar audio should come from a pack blob, got ${info.scheme}`);
if (!(info.duration > 0.3)) fail(`grammar audio did not decode (duration=${info.duration})`);

if (off.length) fail(`off-origin requests: ${off.slice(0, 3).join(', ')}`);
if (errors.length) fail(`console errors: ${errors.slice(0, 3).join(' | ')}`);
log('0 off-origin requests, 0 console errors');

await browser.close();
console.log('\nRESULT: PASS — v0.5 P1+P2 acceptance met (HSK grammar offline; Tex with audio)');
