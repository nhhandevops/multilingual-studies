/**
 * Installing the optional media pack, the way a learner does.
 *
 * v0.9 moved every `kind='word'` audio BLOB out of content.pack into an opt-in media.pack, while
 * leaving the metadata (speaker, credit) in core. A fresh Playwright context gets an empty OPFS,
 * so any script that asserts something about a RECORDING has to install the media pack first —
 * otherwise `getWordAudio` correctly reports "no recording" (that guard is what stops the
 * recorded-voice label from lying) and the script measures the media-absent state instead.
 *
 * Drive the real control rather than calling `db.installMedia()` through `page.evaluate`: the
 * install path IS part of what these scripts accept, and a helper that bypasses the UI would
 * keep passing after the UI broke.
 *
 * This lives here because three scripts needed it and the third copy is where `newestPack` was
 * born (v0.7 shipped a stale-pack bug that four scripts had independently reinvented).
 */

/**
 * Install the media pack from /review if it is not already installed. Leaves the browser on
 * /review — callers navigate on. Returns the button label observed before installing.
 */
export async function installMediaPack(page, log = () => {}, timeout = 300_000) {
  await page.click('header.top nav a[href="/review"]');
  await page.waitForSelector('.media-pack button', { timeout: 60_000 });
  const before = (await page.textContent('.media-pack button')).trim();
  // The install button names the size ("Tải gói âm thanh (~87 MB)"); the remove button never
  // does. Presence of the file is the setting, so this is the whole state check.
  if (!/MB/.test(before)) {
    log(`media pack: already installed ("${before}")`);
    return before;
  }
  await page.click('.media-pack button');

  // Wait for EITHER outcome in one predicate. Waiting only for success burns the full timeout on
  // a failed install and then throws a bare TimeoutError, hiding the reason the control is
  // already displaying: provider.tsx clears `busy` on rejection, so the install button comes back
  // looking exactly as it did before and the success predicate can never become true.
  const outcome = await page
    .waitForFunction(
      () => {
        const root = document.querySelector('.media-pack');
        if (!root) return null;
        const err = root.querySelector('.error');
        if (err) return { error: err.textContent.trim() };
        const btn = root.querySelector('button');
        // While busy the control renders a progress line and NO button, so this cannot fire early.
        return btn && !/MB/.test(btn.textContent) ? { ok: btn.textContent.trim() } : null;
      },
      null, // must pass the arg explicitly — a 2-arg call takes the options object AS the arg and
      { timeout }, // silently falls back to the 30 s default (this bit verify-v09 for a version)
    )
    .then((handle) => handle.jsonValue());

  if (outcome.error) throw new Error(`ASSERT: media pack install failed: ${outcome.error}`);
  log(`media pack: "${before}" → "${outcome.ok}"`);
  return before;
}
