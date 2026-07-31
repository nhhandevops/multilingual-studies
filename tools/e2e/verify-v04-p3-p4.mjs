// v0.4 P3+P4 acceptance:
//  P3 "French words speak with a human voice"
//   1. the pack carries Lingua Libre FR recordings, every one attributed to its own speaker
//   2. a French word page plays a real, decodable clip out of the pack (blob:, not the network)
//  P4 "TTS fallback — missing audio never blocks"
//   3. a word with NO recording still offers playback, marked as synthetic
//   4. clicking it speaks the right text in the right language
//   5. a recorded clip always WINS over TTS when both are available
//   6. with no installed voice and no recording, no button is shown at all (not a dead button)
//   7. nothing is fetched off-origin in any of the above
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
const frClips = pdb.prepare("SELECT COUNT(*) n FROM audio WHERE lang='fr' AND kind='word'").get().n;
const frSpeakers = pdb.prepare("SELECT COUNT(DISTINCT speaker) n FROM audio WHERE lang='fr' AND kind='word'").get().n;
const badAttr = pdb.prepare(`SELECT COUNT(*) n FROM audio
  WHERE attribution IS NULL OR attribution='' OR license IS NULL OR license='' OR speaker IS NULL OR speaker=''`).get().n;
const nc = pdb.prepare("SELECT COUNT(*) n FROM audio WHERE license LIKE '%NC%' OR license LIKE '%ND%'").get().n;
const cov = pdb.prepare(`SELECT COUNT(DISTINCT w.id) n FROM words w JOIN word_audio wa ON wa.word_id=w.id
  WHERE w.lang='fr' AND w.level IN ('A1','A2','B1')`).get().n;
const tot = pdb.prepare("SELECT COUNT(*) n FROM words WHERE lang='fr' AND level IN ('A1','A2','B1')").get().n;
const totAll = pdb.prepare("SELECT COUNT(*) n FROM words WHERE lang='fr' AND level IS NOT NULL").get().n;
const covAll = pdb.prepare(`SELECT COUNT(DISTINCT w.id) n FROM words w JOIN word_audio wa ON wa.word_id=w.id
  WHERE w.lang='fr' AND w.level IS NOT NULL`).get().n;

// P3 needs the Lingua Libre crawl to have landed; P4 does not. Running the TTS half against a
// pack without French audio is a real check, not a stub, so the script degrades instead of
// failing — but it says loudly which half it ran.
const P3 = frClips > 0;
log(`pack ${newest}: ${frClips} FR clips from ${frSpeakers} speakers${P3 ? '' : '  — P3 SKIPPED (no FR audio in this pack yet)'}`);
if (P3) log(`FR coverage: ${cov}/${tot} of A1-B1 = ${(100 * cov / tot).toFixed(0)}% | ${covAll}/${totAll} of all levelled = ${(100 * covAll / totAll).toFixed(0)}%`);
log(`attribution gaps: ${badAttr} | NC/ND clips: ${nc}`);
if (badAttr !== 0) fail('v0.4 gate — every audio row needs attribution, license AND a named speaker');
if (nc !== 0) fail('v0.4 gate — zero NC/ND clips');
if (P3 && frSpeakers < 2) fail(`expected several Lingua Libre speakers, got ${frSpeakers}`);

// A word that HAS a recording (French once the crawl lands, else a Mandarin one — the
// "recording beats TTS" contract is the same either way), and one that has none.
const frTarget = P3
  ? pdb.prepare(`SELECT w.id, w.headword FROM words w JOIN word_audio wa ON wa.word_id=w.id
      WHERE w.lang='fr' AND w.level='A1' AND length(w.headword)>3
      ORDER BY w.freq_rank IS NULL, w.freq_rank LIMIT 1`).get()
  : pdb.prepare(`SELECT w.id, w.headword FROM words w JOIN word_audio wa ON wa.word_id=w.id
      WHERE w.lang='zh' AND w.level='HSK1' ORDER BY w.freq_rank IS NULL, w.freq_rank LIMIT 1`).get();
const noAudio = pdb.prepare(`SELECT w.id, w.headword FROM words w
  WHERE w.lang='en' AND w.level IS NOT NULL AND length(w.headword)>3
    AND NOT EXISTS (SELECT 1 FROM word_audio wa WHERE wa.word_id=w.id)
  ORDER BY w.freq_rank IS NULL, w.freq_rank LIMIT 1`).get();
const attr = pdb.prepare('SELECT attribution, speaker FROM audio a JOIN word_audio wa ON wa.audio_id=a.id WHERE wa.word_id=?').get(frTarget.id);
const pdbLicenses = pdb.prepare(`SELECT license, COUNT(*) n FROM audio
  WHERE source_id='lingualibre-fra' GROUP BY license ORDER BY n DESC`).all();
pdb.close();
log(`recorded target: ${frTarget.headword} — "${attr.attribution}"`);
log(`no-audio target: ${noAudio.headword} (${noAudio.id})`);
if (!attr.attribution.includes(attr.speaker)) fail('a bundled clip must name its speaker in the attribution');
// NOT "CC BY-SA 4.0": Lingua Libre contributors pick their own terms and most pick CC0. Asserting
// one license here was how the seed's own hardcoded-license bug went unnoticed — the credit must
// carry whatever Commons actually reported for THAT file.
if (P3 && !/(CC0|CC BY(-SA)? \d)/.test(attr.attribution)) fail(`FR clip attribution must name its verified license: ${attr.attribution}`);
if (P3) {
  const spread = pdbLicenses;
  log(`FR licenses in pack: ${spread.map(r => `${r.license} ×${r.n}`).join(', ')}`);
  if (spread.length < 2) fail('expected a per-clip license spread, not one hardcoded value');
}

// ---------------------------------------------------------------- browser
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true, args: ['--autoplay-policy=no-user-gesture-required'],
});

// Headless Chrome ships no speech-synthesis voices, so the platform API is stubbed. That is the
// point of the test: it pins OUR contract (does a voice exist → is the button shown → is the
// right utterance produced), not the vendor's synthesiser.
const VOICE_STUB = voices => `(${(v => {
  const full = v.map(x => ({ name: x.n, lang: x.l, default: false, localService: true, voiceURI: x.n }));
  // Starts EMPTY, exactly like Chrome: getVoices() returns [] until the engine has enumerated
  // them, then 'voiceschanged' fires. Handing back a populated list on the first call would
  // skip the whole async path and silently pass even if subscribeVoices were deleted.
  let list = [];
  window.__spoken = [];
  window.__cancelled = 0;
  let busy = false; // models synth.speaking, so a repeat press exercises the cancel path
  const bus = new EventTarget();
  window.__loadVoices = () => { list = full; bus.dispatchEvent(new Event('voiceschanged')); };
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      get speaking() { return busy; },
      get pending() { return false; },
      getVoices: () => list,
      speak: u => { busy = true; window.__spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice && u.voice.name }); },
      cancel: () => { busy = false; window.__cancelled++; },
      addEventListener: (...a) => bus.addEventListener(...a),
      removeEventListener: (...a) => bus.removeEventListener(...a),
    },
  });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
}).toString()})(${JSON.stringify(voices)})`;

async function session(voices, autoload = true) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(VOICE_STUB(voices));
  const page = await ctx.newPage();
  const errors = [], off = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
  page.on('request', r => { if (!/^(http:\/\/localhost:5173|data:|blob:)/.test(r.url())) off.push(r.url()); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input.searchbox', { timeout: 300000 });
  // The stub always starts with an empty voice list; deliver them the way Chrome does.
  if (voices.length > 0 && autoload) await page.evaluate(() => window.__loadVoices());
  return { ctx, page, errors, off };
}

async function openWord(page, headword) {
  // in-app navigation, never page.goto — a fresh document load can lose the OPFS handles
  await page.click('nav a[href="/"]').catch(() => {});
  await page.waitForSelector('input.searchbox', { timeout: 60000 });
  await page.fill('input.searchbox', '');
  await page.fill('input.searchbox', headword);
  await page.waitForFunction(
    h => [...document.querySelectorAll('ul.words .hw')].some(e => e.textContent.trim() === h),
    headword, { timeout: 30000 });
  await page.click(`ul.words li:has(.hw:text-is("${headword}")) a`);
  await page.waitForSelector('.word-detail', { timeout: 60000 });
}

// ===== 0. voices that arrive LATE still light the button up ==================================
// Chrome populates getVoices() asynchronously. If the app read it once at module load, the
// button would be missing forever on a real machine.
const FULL = [{ n: 'Fake FR', l: 'fr-FR' }, { n: 'Fake EN', l: 'en-US' }, { n: 'Fake ZH', l: 'zh-CN' }];
{
  const { ctx, page } = await session(FULL, false); // voices exist but have not arrived yet
  await openWord(page, noAudio.headword);
  await page.waitForTimeout(1000);
  const before = await page.$$eval('.word-detail button.speak', els => els.length);
  await page.evaluate(() => window.__loadVoices()); // fires 'voiceschanged'
  await page.waitForSelector('.word-detail button.speak.tts', { timeout: 10000 })
    .catch(() => fail('button did not appear when voices arrived late (voiceschanged not observed)'));
  log(`late-arriving voices: ${before} buttons before 'voiceschanged', button present after`);
  if (before !== 0) fail('a button was rendered before any voice existed');
  await ctx.close();
}

// ===== 1. a recording plays, and beats TTS even though voices are installed ==================
{
  const { ctx, page, errors, off } = await session(FULL);

  // The headword button must NEVER paint as synthetic for a word we have a recording of.
  // Before the loading state was modelled, `audioId === null` meant both "no clip" and "still
  // looking", so this flashed .tts for a worker round-trip and a fast click spoke the robot.
  let sawTts = false;
  const watch = setInterval(async () => {
    try {
      const c = await page.$$eval('.word-detail > div button.speak.tts', els => els.length);
      if (c > 0) sawTts = true;
    } catch { /* navigating */ }
  }, 25);
  await openWord(page, frTarget.headword);
  await page.waitForSelector('.word-detail button.speak', { timeout: 60000 });
  clearInterval(watch);
  const isTts = await page.evaluate(() => document.querySelector('.word-detail button.speak').classList.contains('tts'));
  if (isTts) fail('a word WITH a recording must not fall back to TTS');
  if (sawTts) fail('a recorded word painted as a synthetic-voice button while its lookup was in flight');
  log('word page: play button present, recorded (not synthetic), and never flashed as TTS');

  // CC BY/BY-SA want the speaker named wherever the clip can be played.
  const credit = await page.textContent('.word-detail .audio-credit').catch(() => null);
  log(`audio credit rendered: ${credit === null ? 'NONE' : `"${credit.trim()}"`}`);
  if (!credit || !credit.includes(attr.speaker)) fail(`the clip's speaker (${attr.speaker}) must be credited in the UI`);

  await page.evaluate(() => {
    window.__played = [];
    const O = window.Audio;
    window.Audio = function (src) { const el = new O(src); window.__played.push(el); return el; };
  });
  await page.locator('.word-detail button.speak').first().click();
  await page.waitForFunction(() => (window.__played ?? []).length > 0, null, { timeout: 20000 });
  const info = await page.evaluate(async () => {
    const el = window.__played[0];
    await new Promise(r => { if (el.readyState >= 1) return r(); el.addEventListener('loadedmetadata', r, { once: true }); setTimeout(r, 5000); });
    return { scheme: el.src.slice(0, 5), duration: el.duration, spoken: window.__spoken.length };
  });
  log(`played ${frTarget.headword}: src=${info.scheme}… duration=${info.duration?.toFixed(2)}s, tts utterances=${info.spoken}`);
  if (info.scheme !== 'blob:') fail(`FR audio should come from a pack blob, got ${info.scheme}`);
  if (!(info.duration > 0.1)) fail(`FR audio did not decode (duration=${info.duration})`);
  if (info.spoken !== 0) fail('recorded playback must not also trigger the synthesiser');

  // ===== 2. a word with NO recording falls back to a clearly-marked synthetic voice ==========
  await openWord(page, noAudio.headword);
  await page.waitForSelector('.word-detail button.speak.tts', { timeout: 60000 });
  const marker = await page.locator('.word-detail button.speak.tts').first().textContent();
  log(`no-recording word offers a synthetic button, marker="${marker.trim()}"`);
  if (!marker.includes('TTS')) fail('synthetic playback must be labelled TTS');
  await page.locator('.word-detail button.speak.tts').first().click();
  const spoken = await page.evaluate(() => window.__spoken);
  log(`spoke: ${JSON.stringify(spoken)}`);
  if (spoken.length !== 1) fail(`expected exactly one utterance, got ${spoken.length}`);
  if (spoken[0].text !== noAudio.headword) fail(`spoke "${spoken[0].text}", expected "${noAudio.headword}"`);
  if (!spoken[0].lang.startsWith('en')) fail(`spoke in ${spoken[0].lang}, expected an en voice`);

  // Pressing again must speak again. Chrome drops an utterance queued in the same task as
  // cancel(), so this is the press that silently does nothing if the yield is ever removed.
  // Zero the counter first: playing the recorded clip earlier legitimately cancelled speech
  // too (the two engines stop each other), and that must not be read as this press's cancel.
  await page.evaluate(() => { window.__cancelled = 0; });
  await page.locator('.word-detail button.speak.tts').first().click();
  await page.waitForFunction(() => window.__spoken.length === 2, null, { timeout: 10000 })
    .catch(() => fail('a repeat press produced no second utterance (cancel/speak race)'));
  const again = await page.evaluate(() => ({ n: window.__spoken.length, cancelled: window.__cancelled }));
  log(`repeat press: ${again.n} utterances, ${again.cancelled} cancel()`);
  if (again.cancelled !== 1) fail('a repeat press should cancel the in-flight utterance exactly once');

  // Example sentences have no bundled audio of their own (Tatoeba's clips are NC-ND), so they
  // get the synthetic voice too — that is the only pronunciation they will ever have.
  const exBtns = await page.$$eval('.examples button.speak.tts', els => els.length);
  log(`example sentences offering synthetic playback: ${exBtns}`);

  if (off.length) fail(`off-origin requests: ${off.slice(0, 3).join(', ')}`);
  if (errors.length) fail(`console errors: ${errors.slice(0, 3).join(' | ')}`);
  log('0 off-origin requests, 0 console errors');
  await ctx.close();
}

// ===== 3. no voices installed + no recording ⇒ no button at all ==============================
{
  const { ctx, page } = await session([]);
  await openWord(page, noAudio.headword);
  await page.waitForSelector('.word-detail', { timeout: 60000 });
  await page.waitForTimeout(1500); // let the async audio lookup settle before asserting absence
  const n = await page.$$eval('.word-detail button.speak', els => els.length);
  log(`no voices + no recording → ${n} play buttons`);
  if (n !== 0) fail('must not render a play button that cannot play anything');

  // ...but a recorded word still plays with no voices installed at all
  await openWord(page, frTarget.headword);
  await page.waitForSelector('.word-detail button.speak', { timeout: 60000 });
  log('recorded FR word still plays with zero installed voices');
  await ctx.close();
}

await browser.close();
console.log('\n✓ v0.4 P3+P4 acceptance PASSED');
