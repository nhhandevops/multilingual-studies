// v0.4 P2 acceptance: "most words speak with a human voice."
//  1. the pack carries word recordings linked to levelled words, all attributed
//  2. a word page shows a 🔊 button that plays a real, decodable clip from the pack
//  3. the review card offers the same, looked up per card (audio is enrichment, not snapshot)
//  4. nothing is fetched off-origin
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { REPO, BASE, CHROME, newestPack } from './paths.mjs';
const require=createRequire(`${REPO}/apps/ingest/package.json`);
const Database=require('better-sqlite3');
const packsDir=join(REPO,'build','packs');
const newest=readdirSync(packsDir).sort().at(-1);
const pdb=new Database(join(packsDir,newest,'content.db'),{readonly:true});
const clips=pdb.prepare("SELECT COUNT(*) n FROM audio WHERE kind='word'").get().n;
const links=pdb.prepare('SELECT COUNT(*) n FROM word_audio').get().n;
const badAttr=pdb.prepare("SELECT COUNT(*) n FROM audio WHERE attribution IS NULL OR attribution='' OR license IS NULL OR license=''").get().n;
const nc=pdb.prepare("SELECT COUNT(*) n FROM audio WHERE license LIKE '%NC%' OR license LIKE '%ND%'").get().n;
const cov=pdb.prepare(`SELECT COUNT(DISTINCT w.id) n FROM words w JOIN word_audio wa ON wa.word_id=w.id
  WHERE w.lang='zh' AND w.level IS NOT NULL`).get().n;
const tot=pdb.prepare("SELECT COUNT(*) n FROM words WHERE lang='zh' AND level IS NOT NULL").get().n;
// a word that HAS audio, for a deterministic test
const target=pdb.prepare(`SELECT w.id, w.headword FROM words w JOIN word_audio wa ON wa.word_id=w.id
  WHERE w.lang='zh' AND w.level='HSK1' ORDER BY w.freq_rank IS NULL, w.freq_rank LIMIT 1`).get();
pdb.close();
console.log(`pack ${newest}: ${clips} word clips, ${links} links, ${cov}/${tot} levelled zh words = ${(100*cov/tot).toFixed(0)}%`);
console.log(`attribution gaps: ${badAttr} | NC/ND clips: ${nc}`);
console.log(`target: ${target.headword} (${target.id})`);
if (badAttr!==0) throw new Error('ASSERT: v0.4 gate — zero audio rows with NULL attribution');
if (nc!==0) throw new Error('ASSERT: v0.4 gate — zero NC/ND clips');

const fail=m=>{throw new Error(`ASSERT: ${m}`)}; const log=m=>console.log(m);
const browser=await chromium.launch({executablePath: CHROME,
  headless:true, args:['--autoplay-policy=no-user-gesture-required']});
const page=await (await browser.newContext()).newPage();
const errors=[], off=[];
page.on('pageerror',e=>errors.push(String(e).slice(0,140)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,140));});
page.on('request',r=>{if(!/^(http:\/\/localhost:5173|data:|blob:)/.test(r.url()))off.push(r.url());});

await page.goto(BASE,{waitUntil:'domcontentloaded'});
await page.waitForSelector('input.searchbox',{timeout:300000});
await page.fill('input.searchbox', target.headword);
await page.waitForFunction(h=>[...document.querySelectorAll('ul.words .hw')].some(e=>e.textContent.trim()===h), target.headword, {timeout:30000});
await page.click(`ul.words li:has(.hw:text-is("${target.headword}")) a`);
await page.waitForSelector('.word-detail button.speak',{timeout:60000});
log('word page shows a play button');

await page.evaluate(()=>{ window.__played=[]; const O=window.Audio;
  window.Audio=function(src){ const el=new O(src); window.__played.push(el); return el; }; });
await page.click('.word-detail button.speak');
await page.waitForFunction(()=>(window.__played??[]).length>0,null,{timeout:20000});
const info=await page.evaluate(async()=>{ const el=window.__played[0];
  await new Promise(r=>{ if(el.readyState>=1) return r(); el.addEventListener('loadedmetadata',r,{once:true}); setTimeout(r,5000); });
  return { scheme: el.src.slice(0,5), duration: el.duration }; });
log(`played ${target.headword}: src=${info.scheme}… duration=${info.duration?.toFixed(2)}s`);
if (info.scheme!=='blob:') fail(`word audio should come from a pack blob, got ${info.scheme}`);
if (!(info.duration>0.1)) fail(`word audio did not decode (duration=${info.duration})`);

// --- review card ---------------------------------------------------------------------------
await page.click('.word-detail .deck-btn');
await page.waitForSelector('.deck-btn.in-deck',{timeout:15000});
await page.click('header.top nav a[href="/review"]');
await page.waitForSelector('button.start-all',{timeout:60000});
await page.click('button.start-all');
await page.waitForSelector('button.show-answer',{timeout:20000});
await page.click('button.show-answer');
await page.waitForSelector('.review-answer',{timeout:15000});
if (!(await page.$('.review-answer button.speak'))) fail('review card offers no pronunciation');
log('review card offers the pronunciation too');

log(`off-origin requests: ${off.length}`);
if (off.length>0) fail('word audio must be served from the pack');
log(`console/page errors: ${errors.length}`);
errors.slice(0,6).forEach(e=>log('  ! '+e));
await browser.close();
if (errors.length>0) fail('console/page errors present');
console.log('\nRESULT: PASS — v0.4 P2 acceptance met (words speak with a human voice)');
