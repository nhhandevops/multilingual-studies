import { chromium } from 'playwright-core';
import { CHROME } from './paths.mjs';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('console', m => console.log(`[${m.type()}]`, m.text().slice(0,220)));
page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0,220)));

console.log('=== load 1 ===');
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input.searchbox', { timeout: 300000 });
console.log('ready 1');

for (const n of [2,3]) {
  console.log(`=== load ${n}: goto /licenses ===`);
  await page.goto('http://localhost:5173/licenses', { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector('main .card', { timeout: 60000 });
    console.log(`ready ${n}: cards =`, (await page.$$('main .card')).length);
  } catch {
    console.log(`FAILED ${n}:`, (await page.$eval('#root', el=>el.textContent.replace(/\s+/g,' ')).catch(()=> '?')).slice(-220));
  }
}
await browser.close();
