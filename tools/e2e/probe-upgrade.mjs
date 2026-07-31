import { chromium } from 'playwright-core';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, BASE, CHROME } from './paths.mjs';
const DIST=join(REPO,'apps/web/dist/packs');
const pub=(d)=>{copyFileSync(join(d,'manifest.json'),join(DIST,'manifest.json'));copyFileSync(join(d,'content.db.gz'),join(DIST,'content.pack'));};
pub(join(REPO,'build/packs/2026.07.30-1'));
const browser=await chromium.launch({executablePath: CHROME,headless:true});
const page=await (await browser.newContext()).newPage();
page.on('console',m=>console.log(`[${m.type()}]`,m.text().slice(0,300)));
page.on('pageerror',e=>console.log('PAGEERROR',String(e).slice(0,300)));
await page.goto(BASE,{waitUntil:'domcontentloaded'});
await page.waitForSelector('input.searchbox',{timeout:300000});
console.log('=== on old pack ===');
console.log('quota:', JSON.stringify(await page.evaluate(async()=>{const e=await navigator.storage.estimate();return {usage:Math.round(e.usage/1048576)+'MB', quota:Math.round(e.quota/1048576)+'MB'}})));
pub(join(REPO,'build/packs/2026.07.30-5'));
console.log('=== swapped, reloading ===');
await page.reload({waitUntil:'domcontentloaded'});
for (let i=0;i<24;i++){
  await page.waitForTimeout(5000);
  const txt=await page.$eval('#root',e=>e.textContent.replace(/\s+/g,' ').slice(0,200)).catch(()=>'?');
  console.log(`t+${(i+1)*5}s: ${txt}`);
  if (await page.$('input.searchbox')) { console.log('READY'); break; }
  if (/Lỗi|error/i.test(txt)) { console.log('ERROR STATE'); break; }
}
console.log('quota after:', JSON.stringify(await page.evaluate(async()=>{const e=await navigator.storage.estimate();return {usage:Math.round(e.usage/1048576)+'MB', quota:Math.round(e.quota/1048576)+'MB'}})));
await browser.close();
