// Regression probe for the critical review finding: a VALID SQLite file that is not a
// user.db backup (user_version=0, arbitrary tables) must be rejected by userImport —
// previously migrations manufactured the expected tables and the file was accepted.
import { chromium } from 'playwright-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

import { REPO, CHROME } from './paths.mjs';
// craft the attack file with better-sqlite3 from the repo workspace
const require = createRequire(`${REPO}/apps/ingest/package.json`);
const Database = require('better-sqlite3');
const evilPath = join(mkdtempSync(join(tmpdir(), 'mls-evil-')), 'random.db');
const evil = new Database(evilPath);
evil.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT); INSERT INTO meta VALUES (\'x\',\'y\');');
evil.close(); // user_version stays 0 — a plausible "wrong file" like content.db

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
});
const page = await (await browser.newContext()).newPage();
page.on('dialog', (d) => void d.accept());

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input.searchbox', { timeout: 180_000 });

// add one card so there is progress to protect
await page.goto('http://localhost:5173/browse', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('ul.words li .deck-btn', { timeout: 30_000 });
await page.click('ul.words li .deck-btn:not(.in-deck)');
await page.waitForSelector('.deck-btn.in-deck', { timeout: 15_000 });

await page.goto('http://localhost:5173/review', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.backup input[type=file]', { state: 'attached', timeout: 30_000 });
await page.setInputFiles('.backup input[type=file]', evilPath);
await page.waitForFunction(
  () => /Không phục hồi được|Restore failed/.test(document.querySelector('main.review')?.textContent ?? ''),
  null,
  { timeout: 30_000 },
);
const text = await page.$eval('main.review', (el) => el.textContent.replace(/\s+/g, ' '));
console.log(`rejection notice: ${/(?:Không phục hồi được|Restore failed)[^A-Z]{0,80}/.exec(text)?.[0]}`);

// The overview's counters refresh asynchronously after the import result lands, so poll for
// the number instead of reading once (same trap as the done screen — see HANDOFF).
await page.waitForFunction(
  () => /Từ mới:\s*1|New:\s*1/.test(document.querySelector('main.review')?.textContent ?? ''),
  null,
  { timeout: 20_000 },
).catch(() => { throw new Error('ASSERT: the 1-card deck must survive the rejected import'); });
await browser.close();
console.log('RESULT: PASS — valid-SQLite-but-not-a-backup file rejected, progress intact');
