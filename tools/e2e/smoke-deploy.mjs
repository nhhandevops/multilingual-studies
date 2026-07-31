// Smoke test the DEPLOYED production build (vite preview), exercising every shipped surface.
import { chromium } from 'playwright-core';

import { BASE, CHROME } from './paths.mjs';
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true, args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0,140)));
page.on('console', m => { if (m.type()==='error') errors.push(m.text().slice(0,140)); });
const t0 = Date.now();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input.searchbox', { timeout: 300000 });
console.log(`boot + pack install: ${((Date.now()-t0)/1000).toFixed(1)}s`);
console.log(`pack: ${await page.$eval('footer.pack', e=>e.textContent.trim())}`);
const nav = await page.$$eval('header.top nav a', as=>as.map(a=>`${a.textContent}(${a.getAttribute('href')})`));
console.log(`nav: ${nav.join(' ')}`);

// search
await page.fill('input.searchbox', 'ni hao');
await page.waitForFunction(()=>document.querySelectorAll('ul.words li').length>0,null,{timeout:20000});
console.log(`search "ni hao": ${(await page.$$eval('ul.words li .hw', e=>e.map(x=>x.textContent))).slice(0,5).join(' ')}`);

// browse
await page.click('header.top nav a[href="/browse"]');
await page.waitForSelector('ul.words li .deck-btn',{timeout:60000});
const levels = await page.$$eval('.chips button', b=>b.map(x=>x.textContent.trim()));
console.log(`browse zh levels: ${levels.slice(3,11).join(' ')}`);

// write / hanzi
await page.click('header.top nav a[href="/write"]');
await page.waitForSelector('ul.glyph-grid li',{timeout:60000});
console.log(`/write hanzi HSK1 page: ${(await page.$$('ul.glyph-grid li')).length} glyphs`);
await page.click('.chips.script button:nth-of-type(2)');
await page.waitForSelector('.glyph.latin',{timeout:20000});
const latin = await page.$$eval('.glyph.latin', g=>g.map(x=>x.textContent));
console.log(`/write latin: ${latin.length} glyphs -> ${latin.join('')}`);

// glyph detail + animation
await page.click(`ul.glyph-grid a[href="/write/${encodeURIComponent('é')}"]`);
await page.waitForSelector('.stroke-stage svg',{timeout:60000});
console.log(`/write/é: ${(await page.$eval('.glyph-head', e=>e.textContent.replace(/\s+/g,' '))).slice(0,60)}`);

// pinyin
await page.click('header.top nav a[href="/pinyin"]');
await page.waitForSelector('table.pinyin-chart button.syl',{timeout:60000});
let total = 0;
for (const n of [1,2,3,4,5]) {
  await page.click(`.chips button:nth-of-type(${n})`);
  await page.waitForFunction(t=>[...document.querySelectorAll('.chips button')][t-1]?.classList.contains('active'),n,{timeout:15000});
  total += (await page.$$('table.pinyin-chart button.syl')).length;
}
console.log(`/pinyin: ${total} syllable cells across 5 tone tabs`);

// tones
await page.click('header.top nav a[href="/tones"]');
await page.waitForSelector('button.tone-btn',{timeout:60000});
console.log(`/tones: ${(await page.$eval('main.tone-drill .hint', e=>e.textContent)).trim()}`);

// ipa
await page.click('header.top nav a[href="/ipa"]');
await page.waitForSelector('button.phone-btn',{timeout:60000});
await page.waitForFunction(()=>{const i=document.querySelector('.diagram img');return i&&i.complete&&i.naturalWidth>0;},null,{timeout:20000});
console.log(`/ipa: ${(await page.$$('button.phone-btn')).length} phones, diagram renders ${await page.$eval('.diagram img', i=>i.naturalWidth+'x'+i.naturalHeight)}`);

// review + deck
await page.click('header.top nav a[href="/review"]');
await page.waitForSelector('.review-summary .card',{timeout:60000});
const decks = await page.$$eval('.review-summary .card h3', h=>h.map(x=>x.textContent.trim()));
console.log(`/review decks: ${decks.join(' | ')}`);
const hasBackup = (await page.$('.backup input[type=file]')) !== null;
console.log(`/review backup export+import present: ${hasBackup}`);

// licenses
await page.click('header.top nav a[href="/licenses"]');
await page.waitForSelector('main .card',{timeout:60000});
const srcs = await page.$$eval('main .card h3 a', a=>a.map(x=>x.textContent.trim()));
console.log(`/licenses: ${srcs.length} sources -> ${srcs.join(', ')}`);

// EN toggle
await page.click('.ui-lang button:nth-of-type(2)');
await page.waitForFunction(()=>/Sources|License/i.test(document.querySelector('main h2')?.textContent??''),null,{timeout:15000});
console.log(`EN toggle: "${await page.$eval('main h2', e=>e.textContent.trim())}"`);

console.log(`\nconsole/page errors: ${errors.length}`);
errors.slice(0,6).forEach(e=>console.log('  ! '+e));
await browser.close();
