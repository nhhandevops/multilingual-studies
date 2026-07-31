// Init smoke test per HANDOFF's "Testing recipe": drive installed Chrome against the dev
// server, wait out the first-run pack install, then assert search works in all three languages.
import { chromium } from 'playwright-core';


import { BASE, CHROME } from './paths.mjs';
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

const t0 = Date.now();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input.searchbox', { timeout: 180_000 }); // pack install ~1 min first run
console.log(`searchbox ready after ${((Date.now() - t0) / 1000).toFixed(1)}s (pack install + OPFS)`);

async function search(q, expectHw) {
  await page.fill('input.searchbox', '');
  await page.fill('input.searchbox', q);
  // Wait for THIS query's results: the previous query's rows linger in the DOM during the
  // 150ms debounce + async query, so waiting on `ul.words li` alone reads stale rows.
  try {
    await page.waitForFunction(
      (hw) =>
        [...document.querySelectorAll('ul.words li .hw')].some((e) =>
          (e.textContent ?? '').includes(hw),
        ),
      expectHw,
      { timeout: 30_000 },
    );
  } catch {
    const got = await page.$$eval('ul.words li .hw', (es) => es.map((e) => e.textContent).slice(0, 5));
    throw new Error(`"${q}": expected a row containing "${expectHw}", got ${JSON.stringify(got)}`);
  }
  const rows = await page.$$eval('ul.words li', (ls) =>
    ls.slice(0, 3).map((li) => ({
      lang: li.querySelector('.badge')?.textContent ?? '',
      hw: li.querySelector('.hw')?.textContent ?? '',
      reading: li.querySelector('.reading')?.textContent ?? '',
      gloss: (li.querySelector('.gloss')?.textContent ?? '').slice(0, 60),
      href: li.querySelector('a')?.getAttribute('href') ?? '',
    })),
  );
  const count = await page.$$eval('ul.words li', (ls) => ls.length);
  console.log(`\n"${q}" -> ${count} results`);
  for (const r of rows) console.log(`   [${r.lang}] ${r.hw} ${r.reading} — ${r.gloss}`);
  return rows.find((r) => r.hw.includes(expectHw)) ?? rows[0];
}

const zh = await search('你好', '你好');
await search('record', 'record');
await search('bonjour', 'bonjour');
await search('ni hao', '你好'); // pinyin search path
await search('好', '好'); //      CJK substring path

// word detail
await page.goto(`${BASE}${zh.href}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.word-detail .hw', { timeout: 30_000 });
const detail = await page.$eval('.word-detail', (el) => el.textContent.replace(/\s+/g, ' ').slice(0, 180));
console.log(`\nword detail (${zh.href}):\n   ${detail}`);
const senses = await page.$$eval('.senses li', (ls) => ls.length);
console.log(`   senses rendered: ${senses}`);

// licenses screen
await page.goto(`${BASE}/licenses`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.card', { timeout: 30_000 });
const cards = await page.$$eval('.card', (cs) => cs.length);
const names = await page.$$eval('.card', (cs) =>
  cs.map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').slice(0, 40)),
);
console.log(`\nlicenses screen: ${cards} source cards`);
for (const n of names) console.log(`   ${n}`);

// browse by level
await page.goto(`${BASE}/browse`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.chips button', { timeout: 30_000 });
const levelBtns = await page.$$eval('.chips button', (bs) => bs.map((b) => b.textContent));
console.log(`\nbrowse chips: ${levelBtns.slice(0, 14).join(' ')}`);
await page.waitForSelector('ul.words li', { timeout: 30_000 });
const browseCount = await page.$$eval('ul.words li', (ls) => ls.length);
console.log(`   default browse list: ${browseCount} rows`);

console.log(`\njs/console errors: ${errors.length}`);
for (const e of errors.slice(0, 10)) console.log(`   ! ${e}`);
await browser.close();
console.log(errors.length === 0 && senses > 0 && cards >= 9 ? '\nRESULT: PASS' : '\nRESULT: CHECK ABOVE');
