import { chromium } from 'playwright-core';
import { CHROME } from './paths.mjs';
const B='http://localhost:5173';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await (await browser.newContext()).newPage();
page.on('console', m => { if (m.type()==='log' && m.text().includes('sqlite.worker')) console.log('  ', m.text()); });

const ready = async (sel, label) => {
  try { await page.waitForSelector(sel, { timeout: 90000 }); console.log(`  OK ${label}`); }
  catch { console.log(`  FAIL ${label}:`, (await page.$eval('#root', e=>e.textContent.replace(/\s+/g,' ')).catch(()=>'?')).slice(-180)); }
};

console.log('1. goto /');            await page.goto(B, {waitUntil:'domcontentloaded'});            await ready('input.searchbox','/');
console.log('2. goto /write/好');    await page.goto(`${B}/write/${encodeURIComponent('好')}`, {waitUntil:'domcontentloaded'}); await ready('.stroke-stage svg','/write/好');
console.log('3. goBack');            await page.goBack({waitUntil:'domcontentloaded'});             await ready('input.searchbox','back to /');
console.log('4. goto /licenses');    await page.goto(`${B}/licenses`, {waitUntil:'domcontentloaded'}); await ready('main .card','/licenses');
await browser.close();
