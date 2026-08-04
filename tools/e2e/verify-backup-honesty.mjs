/**
 * Acceptance: the app never claims a backup it cannot confirm.
 *
 * user.db is the only irreplaceable data in this product, and the weekly nag is PLAN risk #3's
 * whole mitigation. Until this script existed, `onExport` wrote `last_backup_at` immediately
 * after `a.click()` — so a download the browser cancelled or blocked still bought seven days of
 * silence, permanently, with no signal to the learner. Measured, not theorised: cancelling the
 * download made `.backup-nag` disappear and stay gone across a full reload.
 *
 *   1. an UNCONFIRMED export snoozes for a day — it does NOT record a backup
 *   2. the learner confirming the file IS the backup record, and it lasts a week (then expires)
 *   3. a FAILING export says so on screen instead of dying as an unhandled rejection
 *   4. a REFUSED durable-storage request says so instead of looking like a no-op
 *
 * Needs `pnpm dev` (off-origin allow-list is derived from BASE, so the static server works too).
 */
import { chromium } from 'playwright-core';
import { BASE, CHROME } from './paths.mjs';

const DAY = 864e5;
const fail = (m) => { throw new Error(`ASSERT: ${m}`); };
const log = (m) => console.log(m);
const ORIGIN = new URL(BASE).origin;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

/** Fresh profile => empty OPFS => the pack installs and user.db starts empty. */
async function session(init) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 160)}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 160)}`); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input.searchbox', { timeout: 300_000 });
  return { ctx, page, errors };
}

/**
 * The nag only evaluates for a learner who HAS something to lose, so give it a card — then
 * reload, because BackupNag reads user.db once per mount and stays mounted across routes. That
 * is the real behaviour (a weekly reminder decided at boot), so the test has to live with it
 * rather than assert a freshness the component never promised.
 */
async function seedOneCard(page) {
  await page.fill('input.searchbox', '的');
  await page.waitForFunction(
    () => [...document.querySelectorAll('ul.words .hw')].some((e) => e.textContent.trim() === '的'),
    null, { timeout: 30_000 });
  await page.click('ul.words li:has(.hw:text-is("的")) a');
  await page.waitForSelector('.word-detail .deck-btn', { timeout: 30_000 });
  await page.click('.word-detail .deck-btn');
  await page.waitForSelector('.deck-btn.in-deck', { timeout: 15_000 });
  // A reload keeps the current route (/word/…), so wait on the app-ready marker, not the
  // home screen's search box.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('footer.pack', { timeout: 120_000 });
  await page.waitForFunction(() => document.querySelector('.backup-nag') !== null, null, { timeout: 15_000 })
    .catch(() => {});
}

const nagVisible = (page) => page.$('.backup-nag').then(Boolean);

/**
 * Present in the DOM is not the same as seen. The export result used to render ~800 px above the
 * button that produced it, and an assertion on `textContent` cannot tell the difference — so
 * check the element is actually inside the viewport.
 */
async function seenInViewport(page, selector) {
  const el = await page.$(selector);
  if (!el) return { found: false };
  const box = await el.boundingBox();
  const vh = page.viewportSize()?.height ?? 720;
  return { found: true, box, inViewport: !!box && box.y >= 0 && box.y < vh };
}

/** Reload under a debug clock offset and report whether the nag is due then. */
async function nagAfterDays(page, days) {
  await page.evaluate((ms) => localStorage.setItem('mls_debug_clock_offset_ms', String(ms)), days * DAY);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('footer.pack', { timeout: 120_000 });
  // Poll: the nag reads user.db asynchronously, so a single sample right after load is a
  // coin flip — the exact "sample once" trap the README warns about.
  await page.waitForFunction(() => document.querySelector('.backup-nag') !== null, null, { timeout: 8_000 })
    .catch(() => {});
  return nagVisible(page);
}

// ===== 1. an unconfirmed export snoozes for a day, and does NOT record a backup ==============
{
  const { ctx, page, errors } = await session();
  await seedOneCard(page);
  await page.click('header.top nav a[href="/review"]');
  await page.waitForSelector('.backup button.export-backup', { timeout: 60_000 });

  if (!(await nagVisible(page))) fail('a learner with a card and no backup must see the nag');
  log('nag is due for a learner with a card and no backup');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.click('.backup button.export-backup'),
  ]);
  // The download the learner never keeps. The app cannot detect this — which is the point.
  await download.cancel();
  log(`export clicked; download cancelled (failure: ${await download.failure()})`);

  await page.waitForSelector('.backup-confirm', { timeout: 15_000 });
  log('the app ASKS whether the file saved instead of assuming it did');
  // The question must be visible from where the button is, not 800 px up the page.
  await page.$eval('.backup button.export-backup', (e) => e.scrollIntoView({ block: 'center' }));
  const ask = await seenInViewport(page, '.backup-confirm');
  if (!ask.inViewport) fail(`the confirmation prompt renders off-screen (y=${ask.box?.y}) — invisible feedback`);
  log('the question is on screen next to the button that raised it');

  // It must also SURVIVE navigation: it is state of the data, not of this mount. Held in
  // useState it died on the first route change, and nothing else writes last_backup_at.
  await page.click('header.top nav a[href="/"]');
  await page.waitForSelector('input.searchbox', { timeout: 30_000 });
  await page.click('header.top nav a[href="/review"]');
  await page.waitForSelector('.backup button.export-backup', { timeout: 60_000 });
  await page.waitForSelector('.backup-confirm', { timeout: 15_000 })
    .catch(() => fail('the confirmation died on a route change — the learner can no longer record a backup they have'));
  log('the question survives leaving and returning to the screen');

  // The bug this script exists for: an unconfirmed download must NOT buy a week of silence.
  if (!(await nagAfterDays(page, 2)))
    fail('a cancelled/unconfirmed download was recorded as a BACKUP — the app is claiming a file that may not exist');
  log('+2 d: the reminder is still standing — an unconfirmable download was never recorded as a backup');

  // ...and it must say the TRUE thing. Repeating "over 7 days since your last backup" a day
  // after an export the app itself recorded is a second dishonesty in place of the first.
  const nagText = await page.$eval('.backup-nag', (e) => e.textContent.replace(/\s+/g, ' ').trim());
  log(`nag text at +2 d: ${nagText}`);
  if (/hơn 7 ngày|over 7 days/.test(nagText))
    fail('the reminder claims 7 days have passed while the app knows an export happened 2 days ago');
  if (!/chưa xác nhận|never confirmed/.test(nagText))
    fail('the reminder must name the real situation: an export whose outcome was never confirmed');
  if (!(await page.$('.backup-nag button.confirm-backup')))
    fail('the reminder must offer the one-click confirmation, or it is an alarm with no answer');
  log('+2 d: the reminder states what actually happened, and offers the answer');

  if (errors.length) fail(`console/page errors: ${errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

// ===== 2. confirming IS the backup record: quiet for a week, then due again ==================
{
  const { ctx, page, errors } = await session();
  await seedOneCard(page);
  await page.click('header.top nav a[href="/review"]');
  await page.waitForSelector('.backup button.export-backup', { timeout: 60_000 });
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.click('.backup button.export-backup'),
  ]);
  void dl;
  await page.click('.backup-confirm button.confirm-backup');
  // Assert on the message beside the button, not on the whole screen's text: a message that
  // exists somewhere in main.review can still be 800 px above where the learner is looking.
  await page.waitForFunction(
    () => /Đã ghi nhận|Backup recorded/.test(document.querySelector('.backup-notice')?.textContent ?? ''),
    null, { timeout: 15_000 },
  ).catch(() => fail('confirming a backup gave no feedback next to the button'));
  const ok = await seenInViewport(page, '.backup-notice');
  if (!ok.inViewport) fail(`the confirmation feedback renders off-screen (y=${ok.box?.y})`);
  if (await page.$('.backup-confirm')) fail('the question should be answered and gone after confirming');
  log('learner confirmed the file; the app recorded the backup and said so, in view');

  if (await nagAfterDays(page, 2)) fail('a CONFIRMED backup must buy the full week of silence');
  log('+2 d: quiet, as a real backup should be');
  if (!(await nagAfterDays(page, 8))) fail('the nag must come back a week after the last confirmed backup');
  log('+8 d: due again — the reminder still expires');

  if (errors.length) fail(`console/page errors: ${errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

// ===== 3. a failing export reports itself =====================================================
{
  // Break blob-URL creation the way a quota/permission failure would. Previously this produced
  // a screen identical to success plus an unhandled pageerror nobody sees.
  const { ctx, page, errors } = await session(() => {
    const real = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      if (blob instanceof Blob && blob.type === 'application/octet-stream')
        throw new Error('simulated blob failure');
      return real(blob);
    };
  });
  await seedOneCard(page);
  await page.click('header.top nav a[href="/review"]');
  await page.waitForSelector('.backup button.export-backup', { timeout: 60_000 });
  await page.click('.backup button.export-backup');
  await page.waitForFunction(
    () => /Không tạo được bản sao lưu|Backup failed/.test(document.querySelector('main.review')?.textContent ?? ''),
    null, { timeout: 15_000 },
  ).catch(() => fail('a failing export must tell the learner — it showed nothing'));
  log('a failing export reports the reason on screen');

  if (await page.$('.backup-confirm'))
    fail('a failed export must not ask the learner to confirm a file that was never produced');
  // The nag must survive a failed export.
  if (!(await nagVisible(page))) fail('a failed export must not silence the backup reminder');
  log('failed export: no false confirmation prompt, reminder still standing');

  const unhandled = errors.filter((e) => e.startsWith('pageerror'));
  if (unhandled.length) fail(`the failure escaped as an unhandled rejection: ${unhandled[0]}`);
  await ctx.close();
}

// ===== 4. a refused durable-storage request says so ===========================================
{
  const { ctx, page, errors } = await session(() => {
    const s = navigator.storage;
    Object.defineProperty(s, 'persist', { value: async () => false, configurable: true });
    Object.defineProperty(s, 'persisted', { value: async () => false, configurable: true });
  });
  await page.click('header.top nav a[href="/review"]');
  await page.waitForSelector('.backup button.protect-storage', { timeout: 60_000 });
  const before = await page.textContent('.backup');
  await page.click('.backup button.protect-storage');
  await page.waitForSelector('.storage-denied', { timeout: 15_000 })
    .catch(() => fail('a refused persistence request rendered NOTHING — indistinguishable from a no-op'));
  const after = await page.textContent('.backup');
  if (before === after) fail('the panel is character-identical after a refused request');
  log('a refused durable-storage request is reported, not swallowed');

  if (errors.length) fail(`console/page errors: ${errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

// ===== 5. a FAILING confirmation keeps the question alive =====================================
// The click that records the backup is the only writer of last_backup_at. The first version of
// this fix tore the prompt down before awaiting the write and had no catch — so a failed write
// left the learner with the file on disk, no message, no prompt, and a nag two days later. That
// is the exact silent-failure shape the whole change exists to remove, reintroduced inside it.
{
  const { ctx, page, errors } = await session(() => {
    // Break ONLY the last_backup_at write — the INSERT, never the SELECT that reads it back, so
    // the reminder's verdict afterwards is still the product's own. Counted on `window`, because
    // an injection that quietly matches nothing looks exactly like a product that handled the
    // failure: the first version of this stub keyed on `msg.args` (the field is `params`) and
    // reported a clean pass for a case it never exercised.
    window.__blockedWrites = 0;
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (msg, ...rest) {
      let body = '';
      try { body = JSON.stringify(msg) ?? ''; } catch { body = ''; }
      if (body.includes('last_backup_at') && /INSERT\s+INTO\s+settings/i.test(body)) {
        window.__blockedWrites++;
        throw new Error('simulated settings write failure');
      }
      return post.call(this, msg, ...rest);
    };
  });
  await seedOneCard(page);
  await page.click('header.top nav a[href="/review"]');
  await page.waitForSelector('.backup button.export-backup', { timeout: 60_000 });
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.click('.backup button.export-backup'),
  ]);
  void dl;
  await page.waitForSelector('.backup-confirm button.confirm-backup', { timeout: 15_000 });
  await page.click('.backup-confirm button.confirm-backup');
  await page.waitForTimeout(1500);

  const blocked = await page.evaluate(() => window.__blockedWrites ?? 0);
  if (blocked === 0)
    fail('the failure injection never fired — this case was not exercised, so its pass means nothing');
  const stillAsking = Boolean(await page.$('.backup-confirm button.confirm-backup'));
  const said = await page.$eval('.backup', (e) => e.textContent.replace(/\s+/g, ' ')).catch(() => '');
  const reported = /Không tạo được|Backup failed|chưa ghi nhớ|could not be remembered/.test(said);
  log(`failed confirmation (${blocked} write(s) blocked) → prompt still clickable: ${stillAsking} · reported: ${reported}`);
  if (!stillAsking && !reported)
    fail('a failed confirmation vanished silently — the learner has the file and no way left to record it');
  const unhandled = errors.filter((e) => e.startsWith('pageerror'));
  if (unhandled.length) fail(`the confirmation failure escaped as an unhandled rejection: ${unhandled[0]}`);
  log('a failed confirmation neither lies nor disappears');
  await ctx.close();
}

await browser.close();
console.log(`\n✓ backup-honesty acceptance PASSED (origin ${ORIGIN})`);
