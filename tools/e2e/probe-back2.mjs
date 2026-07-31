import { chromium } from 'playwright-core';
import { CHROME } from './paths.mjs';
const B='http://localhost:5173';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await (await browser.newContext()).newPage();
await page.goto(B, {waitUntil:'domcontentloaded'});
await page.waitForSelector('input.searchbox', { timeout: 300000 });

// record pagehide/freeze on the page we are about to leave
await page.evaluate(() => {
  localStorage.removeItem('probe');
  const rec = (m) => localStorage.setItem('probe', (localStorage.getItem('probe')||'') + m + ';');
  addEventListener('pagehide', e => rec('pagehide persisted=' + e.persisted));
  addEventListener('freeze', () => rec('freeze'));
});
await page.goto(`${B}/write/${encodeURIComponent('好')}`, {waitUntil:'domcontentloaded'});
await page.waitForSelector('.stroke-stage svg', { timeout: 90000 });
await page.goBack({waitUntil:'domcontentloaded'});
// give the restored/reloaded page time, then poll how long until the DB opens
const t0 = Date.now();
let opened = false;
for (let i=0;i<40;i++) {
  if (await page.$('input.searchbox')) { opened = true; break; }
  const err = await page.$eval('#root', e=>e.textContent).catch(()=> '');
  await page.waitForTimeout(500);
}
console.log('searchbox after goBack:', opened, `${Date.now()-t0}ms`);
console.log('probe markers from the page we left:', await page.evaluate(() => localStorage.getItem('probe')));
console.log('root text tail:', (await page.$eval('#root', e=>e.textContent.replace(/\s+/g,' ')).catch(()=>'?')).slice(-160));
// now reload manually: does it recover?
await page.reload({waitUntil:'domcontentloaded'});
try { await page.waitForSelector('input.searchbox',{timeout:90000}); console.log('after manual reload: OK'); }
catch { console.log('after manual reload: STILL BROKEN'); }
await browser.close();
