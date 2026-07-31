import { chromium } from 'playwright-core';

import { BASE, CHROME } from './paths.mjs';
const browser=await chromium.launch({executablePath: CHROME,headless:true});
const page=await (await browser.newContext()).newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e).slice(0,140)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,140));});
await page.goto(BASE,{waitUntil:'domcontentloaded'});
await page.waitForSelector('input.searchbox',{timeout:300000});

// empty deck first: what does /review say?
await page.click('header.top nav a[href="/review"]');
await page.waitForSelector('main.review',{timeout:60000});
console.log(`/review (empty deck): "${(await page.$eval('main.review',e=>e.textContent.replace(/\s+/g,' '))).slice(0,120)}"`);

// add a word card + a writing card, then re-check
await page.click('header.top nav a[href="/browse"]');
await page.waitForSelector('ul.words li .deck-btn',{timeout:60000});
await page.click('ul.words li .deck-btn:not(.in-deck)');
await page.waitForSelector('.deck-btn.in-deck',{timeout:15000});
await page.click('header.top nav a[href="/write"]');
await page.waitForSelector('ul.glyph-grid li',{timeout:60000});
await page.click('.chips.script button:nth-of-type(2)');
await page.waitForSelector('.glyph.latin',{timeout:20000});
await page.click(`ul.glyph-grid a[href="/write/${encodeURIComponent('é')}"]`);
await page.waitForSelector('.glyph-detail .deck-btn',{timeout:60000});
await page.click('.glyph-detail .deck-btn');
await page.waitForSelector('.glyph-detail .deck-btn.in-deck',{timeout:15000});

await page.click('header.top nav a[href="/review"]');
await page.waitForSelector('.review-summary .card',{timeout:60000});
console.log(`/review decks: ${(await page.$$eval('.review-summary .card h3',h=>h.map(x=>x.textContent.trim()))).join(' | ')}`);
console.log(`/review state: "${(await page.$eval('main.review',e=>e.textContent.replace(/\s+/g,' '))).slice(0,150)}"`);
console.log(`backup export+import present: ${(await page.$('.backup input[type=file]'))!==null}`);

// a full review of the Latin card, incl. the writer on the answer side
await page.click('button.start-all');
await page.waitForSelector('button.show-answer',{timeout:20000});
const front=await page.$eval('.review-hw',e=>e.textContent.trim());
await page.click('button.show-answer');
await page.waitForSelector('button.rating-good',{timeout:15000});
const writer=(await page.$('.review-answer .stroke-stage svg'))!==null;
const ivs=await page.$$eval('button.rating .iv',e=>e.map(x=>x.textContent));
console.log(`review card "${front}": writer on answer=${writer}, interval previews=${ivs.join('/')}`);

await page.click('header.top nav a[href="/licenses"]');
await page.waitForSelector('main .card',{timeout:60000});
const srcs=await page.$$eval('main .card h3 a',a=>a.map(x=>x.textContent.trim()));
console.log(`/licenses: ${srcs.length} sources`);
console.log(`   ${srcs.join(' · ')}`);
await page.click('.ui-lang button:nth-of-type(2)');
await page.waitForFunction(()=>/Sources|Licen/i.test(document.querySelector('main h2')?.textContent??''),null,{timeout:15000});
console.log(`EN toggle: "${await page.$eval('main h2',e=>e.textContent.trim())}"`);
console.log(`\nconsole/page errors: ${errors.length}`);
errors.slice(0,6).forEach(e=>console.log('  ! '+e));
await browser.close();
