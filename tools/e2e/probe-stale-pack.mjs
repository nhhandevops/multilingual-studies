// v0.3 code + a v0.2-era pack still installed (update unreachable = offline).
// The worker deliberately falls back to the installed pack, so what do /write, /pinyin and
// /ipa do when their tables do not exist?
import { chromium } from 'playwright-core';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, BASE, CHROME } from './paths.mjs';
const DIST=join(REPO,'apps/web/dist/packs');
const pub=(d)=>{copyFileSync(join(d,'manifest.json'),join(DIST,'manifest.json'));copyFileSync(join(d,'content.db.gz'),join(DIST,'content.pack'));};
pub(join(REPO,'build/packs/2026.07.30-1'));

const browser=await chromium.launch({executablePath: CHROME,headless:true});
const ctx=await browser.newContext();
const page=await ctx.newPage();
const errs=[];
page.on('pageerror',e=>errs.push(String(e).slice(0,160)));
page.on('console',m=>{ if(m.type()==='error') errs.push(m.text().slice(0,160)); });

await page.goto(BASE,{waitUntil:'domcontentloaded'});
await page.waitForSelector('input.searchbox',{timeout:300000});
console.log('installed:', await page.$eval('footer.pack',e=>e.textContent.trim()));

// now the update is unreachable — exactly the offline fallback path
await ctx.route('**/packs/manifest.json', r => r.abort());
await ctx.route('**/packs/content.pack', r => r.abort());
await page.goto(BASE,{waitUntil:'domcontentloaded'});
await page.waitForSelector('footer.pack',{timeout:120000});
console.log('after offline reload:', await page.$eval('footer.pack',e=>e.textContent.trim()));

for (const [href,label] of [['/write','write'],['/pinyin','pinyin'],['/ipa','ipa'],['/review','review']]) {
  errs.length = 0;
  await page.click(`header.top nav a[href="${href}"]`);
  await page.waitForTimeout(2500);
  const txt = await page.$eval('main', e=>e.textContent.replace(/\s+/g,' ').slice(0,150)).catch(()=>'(NO <main> — still spinning)');
  const warned = await page.$$eval('main .error', es=>es.length);
  console.log(`${label.padEnd(7)} [warn=${warned}] "${txt}"`);
  if (errs.length) console.log(`          errors: ${errs.slice(0,2).join(' | ')}`);
}
await browser.close();
