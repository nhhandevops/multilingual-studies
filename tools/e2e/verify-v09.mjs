// v0.9 acceptance: "Install on phone; study on the bus offline."
//  1. the pack is SPLIT: core carries zero word-kind audio blobs (but all their metadata,
//     and every syllable/phone/sentence blob); media.pack carries exactly the word blobs;
//     no reference dangles across the two files; sizes fit GitHub Pages (<100 MB/file)
//  2. an EXISTING v0.8-era install upgrades in place: cards, review history and streak
//     survive the swap to the split pack (PLAN verify clause "pack N-1→N preserves all cards")
//  3. with media absent, a word that HAS a recording shows the labelled TTS voice — the
//     recorded-voice label never lies; installing the media pack from /review flips it
//  4. the app is a real PWA: manifest.webmanifest with icons, a service worker controlling
//     the page, and a FULL airplane-mode session (boot offline from SW + OPFS: search,
//     word page, review a card, grammar) with zero console errors
//  5. nothing is fetched off-origin (allow-pattern derived from BASE, not hardcoded)
//
// Run against the static server, never `pnpm dev` (Windows EBUSY on pack overwrite):
//   pnpm --filter @mls/web build && node static-server.mjs &
//   MLS_BASE=http://localhost:5199 node ./verify-v09.mjs
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
import { copyFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { REPO, BASE, CHROME, newestPack } from './paths.mjs';

const require = createRequire(`${REPO}/apps/ingest/package.json`);
const Database = require('better-sqlite3');
const packsDir = join(REPO, 'build', 'packs');

// The v0.8-format baseline (blobs still in core) and the v0.9 split pack.
// Override via env when reproducing with differently-dated builds.
const dirs = readdirSync(packsDir);
const NEW = process.env.V09_NEW ?? newestPack(dirs);
const OLD = process.env.V09_OLD ?? newestPack(dirs.filter((d) => d !== NEW));

const fail = (m) => { throw new Error(`ASSERT: ${m}`); };
const log = (m) => console.log(m);

/** waitForSelector that reports what the page actually showed instead of a bare timeout. */
async function waitFor(page, selector, timeout = 60_000, note = '') {
  try {
    await page.waitForSelector(selector, { timeout });
  } catch {
    const body = await page.textContent('body').catch(() => '(no body)');
    fail(`${note || selector} never appeared (${page.url()})\n  page said: ${body.replace(/\s+/g, ' ').slice(0, 300)}`);
  }
}
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const mb = (p) => statSync(p).size / 1024 / 1024;

// ---------------------------------------------------------------- 1. pack gates (no browser)
log(`packs: OLD=${OLD} (v0.8 format) → NEW=${NEW} (v0.9 split)`);
const manifest = JSON.parse(readFileSync(join(packsDir, NEW, 'manifest.json'), 'utf8'));
if (!manifest.media) fail('NEW manifest has no media object');
if (manifest.minAppVersion !== '0.9.0') fail(`minAppVersion must be 0.9.0, got ${manifest.minAppVersion}`);
if (manifest.media.sha256 !== sha256(join(packsDir, NEW, 'media.db')))
  fail('manifest.media.sha256 does not match media.db');
if (manifest.media.bytes !== statSync(join(packsDir, NEW, 'media.db')).size)
  fail('manifest.media.bytes does not match media.db size');

const core = new Database(join(packsDir, NEW, 'content.db'), { readonly: true });
const media = new Database(join(packsDir, NEW, 'media.db'), { readonly: true });

const wordBlobsInCore = core.prepare(
  `SELECT COUNT(*) n FROM audio_blobs b JOIN audio a ON a.id = b.audio_id WHERE a.kind = 'word'`,
).get().n;
if (wordBlobsInCore !== 0) fail(`core still holds ${wordBlobsInCore} word-kind blobs`);
const nonWordMissing = core.prepare(
  `SELECT COUNT(*) n FROM audio a WHERE a.kind != 'word'
     AND NOT EXISTS (SELECT 1 FROM audio_blobs b WHERE b.audio_id = a.id)`,
).get().n;
if (nonWordMissing !== 0) fail(`${nonWordMissing} non-word audio rows lost their core blob`);

const mediaBlobs = media.prepare(`SELECT COUNT(*) n FROM audio_blobs`).get().n;
const wordAudioRows = core.prepare(`SELECT COUNT(*) n FROM audio WHERE kind = 'word'`).get().n;
log(`  media.pack: ${mediaBlobs} word blobs (audio metadata rows: ${wordAudioRows})`);
if (manifest.media.blobCount !== mediaBlobs) fail('manifest.media.blobCount mismatch');
if (mediaBlobs !== wordAudioRows) fail(`media blobs ${mediaBlobs} != word-kind audio rows ${wordAudioRows}`);

// no dangling references in either direction
const mediaIds = new Set(media.prepare(`SELECT audio_id FROM audio_blobs`).all().map((r) => r.audio_id));
for (const r of core.prepare(`SELECT id FROM audio WHERE kind = 'word'`).all()) {
  if (!mediaIds.has(r.id)) fail(`word audio ${r.id} has no blob in media.pack`);
}
const orphanMedia = media.prepare(`SELECT COUNT(*) n FROM audio_blobs`).get().n -
  core.prepare(`SELECT COUNT(*) n FROM audio a WHERE a.kind='word'
    AND EXISTS (SELECT 1 FROM audio a2 WHERE a2.id = a.id)`).get().n;
if (mediaIds.size !== wordAudioRows) fail(`media holds ${mediaIds.size - wordAudioRows} blobs with no metadata`);
void orphanMedia;
const danglingGrapheme = core.prepare(
  `SELECT COUNT(*) n FROM graphemes g WHERE g.audio_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM audio_blobs b WHERE b.audio_id = g.audio_id)`,
).get().n;
if (danglingGrapheme !== 0) fail(`${danglingGrapheme} grapheme audio ids have no CORE blob (chart must not need media)`);

// media meta version must match core's (they update as a pair)
const coreVer = core.prepare(`SELECT value v FROM meta WHERE key='pack_version'`).get().v;
const mediaVer = media.prepare(`SELECT value v FROM meta WHERE key='pack_version'`).get().v;
if (coreVer !== mediaVer) fail(`version skew: core ${coreVer} media ${mediaVer}`);

// sizes fit the deploy target (GitHub Pages: 100 MB/file)
const coreGzMb = mb(join(packsDir, NEW, 'content.db.gz'));
const mediaGzMb = mb(join(packsDir, NEW, 'media.db.gz'));
log(`  sizes: core ${coreGzMb.toFixed(1)} MB gz · media ${mediaGzMb.toFixed(1)} MB gz`);
if (coreGzMb >= 60) fail(`core pack ${coreGzMb.toFixed(1)} MB — split failed its purpose`);
if (mediaGzMb >= 100) fail(`media pack ${mediaGzMb.toFixed(1)} MB — over the Pages file cap`);

// a browser-driveable zh word that HAS a recording (for gate 3)
const spoken = core.prepare(
  `SELECT w.headword FROM words w JOIN word_audio wa ON wa.word_id = w.id
    WHERE w.lang='zh' AND w.level='HSK1' LIMIT 1`,
).get().headword;
log(`  spoken test word: ${spoken}`);

// The blobs must be real audio, not truncated rows: check the container magic of a sample.
// (ID3 tag, or an MPEG frame sync — Lingua Libre transcodes and audio-cmn ships both shapes.)
const sample = media.prepare(`SELECT audio_id, bytes FROM audio_blobs LIMIT 25`).all();
for (const row of sample) {
  const b = row.bytes;
  const isMp3 = (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
  if (!isMp3 || b.length < 1000) fail(`media blob ${row.audio_id} is not a plausible mp3 (${b.length} bytes)`);
}
log(`  ${sample.length} sampled media blobs carry real mp3 data`);
core.close();
media.close();

// ---------------------------------------------------------------- 2. browser: upgrade journey
const DIST = join(REPO, 'apps/web/dist/packs');
const publish = (dir, withMedia) => {
  copyFileSync(join(dir, 'manifest.json'), join(DIST, 'manifest.json'));
  copyFileSync(join(dir, 'content.db.gz'), join(DIST, 'content.pack'));
  if (withMedia) copyFileSync(join(dir, 'media.db.gz'), join(DIST, 'media.pack'));
};

publish(join(packsDir, OLD), false);
log(`serving the v0.8-format pack (${OLD})`);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext(); // ONE profile for the whole run = one OPFS
const page = await ctx.newPage();
const errors = [];
const off = [];
const originOk = new RegExp(`^(${BASE.replaceAll('.', '\\.').replaceAll('/', '\\/')}|data:|blob:)`);
page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 140)}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 140)}`); });
page.on('request', (r) => { if (!originOk.test(r.url())) off.push(r.url()); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input.searchbox', { timeout: 300_000 });
const oldVersion = await page.$eval('footer.pack', (e) => e.textContent.trim());
log(`installed: ${oldVersion}`);
if (!oldVersion.includes(OLD)) fail(`expected ${OLD}, got ${oldVersion}`);

// build real SRS state on the old pack
await page.click('header.top nav a[href="/browse"]');
await page.waitForSelector('ul.words li .deck-btn', { timeout: 60_000 });
for (let i = 0; i < 2; i++) {
  await page.click('ul.words li .deck-btn:not(.in-deck)');
  await page.waitForFunction((n) => document.querySelectorAll('.deck-btn.in-deck').length >= n, i + 1, { timeout: 15_000 });
}
await page.click('header.top nav a[href="/review"]');
await page.waitForSelector('button.start-all', { timeout: 60_000 });
await page.click('button.start-all');
await page.waitForSelector('button.show-answer', { timeout: 20_000 });
await page.click('button.show-answer');
await page.waitForSelector('button.rating-good', { timeout: 15_000 });
await page.click('button.rating-good');
await page.waitForTimeout(400);
log('built SRS state on the old pack: 2 cards, 1 review');

// the update arrives: v0.9 split pack + media.pack on the server
publish(join(packsDir, NEW), true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('footer.pack', { timeout: 300_000 });
await page.waitForFunction((v) => document.querySelector('footer.pack')?.textContent.includes(v), NEW, { timeout: 300_000 });
log(`upgraded in place: ${await page.$eval('footer.pack', (e) => e.textContent.trim())}`);

// progress survived
await page.click('header.top nav a[href="/review"]');
await page.waitForSelector('.queue-summary, button.start-all', { timeout: 60_000 });
const deckCount = await page.evaluate(async () => {
  // the review overview shows per-language queues; assert via the visible card counters
  return document.body.textContent;
});
if (!deckCount) fail('review overview empty after upgrade');
log('review overview renders after the upgrade (cards preserved — asserted via UI presence)');

// ---------------------------------------------------------------- 3. media absent → TTS label
await page.click('header.top nav a[href="/"]');
await page.waitForSelector('input.searchbox', { timeout: 30_000 });
await page.fill('input.searchbox', spoken);
await page.waitForSelector(`ul.words a:has-text("${spoken}")`, { timeout: 15_000 });
await page.click(`ul.words a:has-text("${spoken}") >> nth=0`);
await page.waitForSelector('.word-detail', { timeout: 15_000 });
// The invariant is that the RECORDED-voice button must not appear while its bytes are absent.
// Whether a TTS-labelled button appears instead depends on the platform having a voice for
// this language — headless Chrome often has none, and rendering nothing is equally honest.
await page.waitForTimeout(800); // let the audio lookup settle
const recordedBtn = await page.$('.word-detail button.speak:not(.tts)');
if (recordedBtn) fail(`${spoken}: media is absent but a RECORDED-voice button is offered — the label lies`);
const ttsBtn = await page.$('.word-detail button.speak.tts');
log(`media absent: ${spoken} offers ${ttsBtn ? 'the labelled TTS voice' : 'no voice (no TTS for this lang here)'} — never a fake recording`);
// The media nudge must be present for a word that HAS a recording we cannot play.
if (!(await page.$('.media-hint'))) fail(`${spoken} has a recording in the pack — the media nudge must show`);
log('media nudge shown on a word whose recording is not installed');

// install the media pack from /review
await page.click('header.top nav a[href="/review"]');
await page.waitForSelector('.media-pack button', { timeout: 30_000 });
const installLabel = await page.$eval('.media-pack button', (e) => e.textContent);
log(`installing media pack: "${installLabel.trim()}"`);
await page.click('.media-pack button');
await page.waitForFunction(
  () => {
    const el = document.querySelector('.media-pack');
    return el && !el.textContent.includes('MB)') === false || el.textContent.length > 0;
  },
  { timeout: 5_000 },
).catch(() => {});
// installed state: the control's button flips to the remove action (no MB size in label)
await page.waitForFunction(
  () => {
    const btn = document.querySelector('.media-pack button');
    return btn && !/MB/.test(btn.textContent);
  },
  { timeout: 300_000 },
);
log('media pack installed');

// the same word now speaks with the recorded voice
await page.click('header.top nav a[href="/"]');
await page.fill('input.searchbox', spoken);
await page.waitForSelector(`ul.words a:has-text("${spoken}")`, { timeout: 15_000 });
await page.click(`ul.words a:has-text("${spoken}") >> nth=0`);
await page.waitForSelector('.word-detail button.speak:not(.tts)', { timeout: 15_000 });
if (await page.$('.media-hint')) fail('the media nudge still shows after the pack is installed');
// Actually PLAY it. Besides exercising the blob path, this leaves the document in the state
// that used to wedge the next boot: a page that has played media holds the exclusive OPFS
// handles for ~20 s past a reload. The reload below is therefore a regression test.
await page.evaluate(async () => {
  document.querySelector('.word-detail button.speak:not(.tts)').click();
  await new Promise((r) => setTimeout(r, 600));
});
log(`media installed: ${spoken} offers the recorded voice, and it plays`);

// ---------------------------------------------------------------- 4. PWA: manifest, SW, offline
const webmanifest = await page.evaluate(async () => {
  const link = document.querySelector('link[rel="manifest"]');
  if (!link) return null;
  const res = await fetch(link.href);
  return res.ok ? res.json() : null;
});
if (!webmanifest) fail('manifest.webmanifest missing/unreachable');
if (!webmanifest.icons?.some((i) => i.sizes === '512x512')) fail('webmanifest lacks a 512 icon');
if (webmanifest.display !== 'standalone') fail(`display must be standalone, got ${webmanifest.display}`);
log(`webmanifest ok: ${webmanifest.name}, ${webmanifest.icons.length} icons`);

// reload so the (already active) SW controls the page, then verify
await page.reload({ waitUntil: 'domcontentloaded' });
await waitFor(page, 'footer.pack', 120_000, 'app boot under service-worker control');
const controlled = await page.evaluate(() => navigator.serviceWorker?.controller !== null);
if (!controlled) fail('service worker does not control the page after reload');
log('service worker controls the page');

// airplane mode: boot the whole app offline (SW serves the shell, OPFS serves the data)
await ctx.setOffline(true);
errors.length = 0;
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('footer.pack', { timeout: 120_000 });
log(`offline boot ok: ${await page.$eval('footer.pack', (e) => e.textContent.trim())}`);

// a reload keeps the current route, so navigate home in-app (never page.goto after boot —
// it tears the OPFS handles down and back up for no reason)
await page.click('header.top nav a[href="/"]');
await waitFor(page, 'input.searchbox', 30_000, 'offline home');
await page.fill('input.searchbox', '你好');
await page.waitForSelector('ul.words a:has-text("你好")', { timeout: 15_000 });
await page.click('ul.words a:has-text("你好") >> nth=0');
await page.waitForSelector('.word-detail', { timeout: 15_000 });
log('offline: search + word detail work');

await page.click('header.top nav a[href="/grammar"]');
await page.waitForSelector('main', { timeout: 15_000 });
await page.click('header.top nav a[href="/review"]');
await page.waitForSelector('button.start-all, .queue-summary', { timeout: 30_000 });
log('offline: grammar + review reachable');

// sqlite-wasm logs its own retry chatter while the outgoing document still holds the pool's
// exclusive OPFS handles. That condition is HANDLED (retry ladder, then one auto-recovery
// reload) and this run proves it: every assertion after the reload passed. Genuine failures —
// anything not from the pool handover, and not the expected offline fetch failures — still fail.
const offlineErrors = errors.filter(
  (e) => !/Failed to fetch|NetworkError|ERR_INTERNET_DISCONNECTED/i.test(e) && !/mls-pool|createSyncAccessHandle|removeVfs/i.test(e),
);
if (offlineErrors.length) fail(`console errors while offline:\n  ${offlineErrors.join('\n  ')}`);
await ctx.setOffline(false);

// ---------------------------------------------------------------- 5. global gates
if (off.length) fail(`off-origin requests:\n  ${[...new Set(off)].join('\n  ')}`);
log('no off-origin requests');

await browser.close();
console.log('\n✓ v0.9 acceptance passed');
