import { chromium } from 'playwright-core';
import { CHROME } from './paths.mjs';
const B='http://localhost:5173';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await (await browser.newContext()).newPage();
await page.goto(B, {waitUntil:'domcontentloaded'});
await page.waitForSelector('input.searchbox', { timeout: 300000 });
await page.goto(`${B}/write/${encodeURIComponent('好')}`, {waitUntil:'domcontentloaded'});
await page.waitForSelector('.stroke-stage svg', { timeout: 90000 });
await page.goBack({waitUntil:'domcontentloaded'});
// the friendly locked screen must appear, with a working Reload button
await page.waitForSelector('.status button.more', { timeout: 60000 });
console.log('locked screen:', (await page.$eval('.status', e=>e.textContent.replace(/\s+/g,' '))).slice(0,140));
await page.click('.status button.more');
await page.waitForSelector('input.searchbox', { timeout: 120000 });
console.log('RESULT: PASS - Reload button recovered the app after the bfcache lock');
await browser.close();
