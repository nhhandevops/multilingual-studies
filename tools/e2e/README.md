# tools/e2e — acceptance scripts

Ad-hoc Playwright scripts that drive a real Chrome against the running app. There is still no
test framework (deliberate — see PLAN); these are the per-version acceptance checks that
HANDOFF.md's "Verified: …" lines refer to. **Every `Script:` reference in HANDOFF points here.**

They lived in a scratch directory until v0.4, which made all of those references dangle on any
machine but the one they were written on. Nothing here may be machine-specific: the repo root is
derived from the script's own location and the Chrome path is discovered or taken from `$CHROME`
([paths.mjs](paths.mjs)).

## Running them

```sh
cd tools/e2e && npm install     # playwright-core only; it drives your installed Chrome
pnpm dev                        # in another terminal, from the repo root
node verify-v04-p3-p4.mjs
```

Overrides: `CHROME=/path/to/chrome`, `MLS_BASE=http://localhost:4173` (for `vite preview`).

Each script exits non-zero and prints `ASSERT: …` on failure, or a `RESULT: PASS` / `✓ … PASSED`
line at the end. Run the lot:

```sh
# Round 1 — against `pnpm dev`. Three scripts are excluded: verify-upgrade and verify-v09 swap
# the pack file underneath the app (Vite's watcher dies with EBUSY on Windows), and
# verify-v10-live drives the deployed site and needs nothing local.
for s in verify-*.mjs; do
  case "$s" in verify-upgrade*|verify-v09*|verify-v10-live*) continue;; esac
  printf '%-32s ' "$s"; node "./$s" >/dev/null 2>&1 && echo PASS || echo FAIL
done

# Round 2 — against the static server. `vite build` EMPTIES dist/, packs included, so re-copy
# them or the server hands out whatever stale pack public/packs happened to hold.
pnpm --filter @mls/web build
cp ../../apps/web/public/packs/{manifest.json,content.pack,media.pack} ../../apps/web/dist/packs/
node static-server.mjs &
MLS_BASE=http://localhost:5199 node ./verify-v09.mjs
MLS_BASE=http://localhost:5199 node ./verify-upgrade-v02-to-v03.mjs

# Round 3 — the live deployment, from anywhere:
node ./verify-v10-live.mjs
```

Status (2026-08-04): **19 of 20 pass.** The five that were red after the UX pass are FIXED — and
the earlier note here diagnosed one of them wrongly, which is worth keeping as a lesson:

| Was failing | Guessed cause | MEASURED cause | Fix |
|---|---|---|---|
| `verify-v02`, `verify-v03-p3`, `verify-v04-p1` | "the browser profile blocks the download" | **wrong.** `.backup button:first-of-type` is a DESCENDANT selector, so it started matching two buttons the day v0.9 put `StorageStateLine` inside `.backup`: its nested `button.linklike` is first-of-type inside its own `<p>` and precedes the export button, and `page.click()` is non-strict. The click landed on "Bảo vệ dữ liệu"; no download was ever requested. The download mechanism is fine (verified: 65,536-byte file, `SQLite format 3\0` header, headless AND headed) | the export button now carries `className="export-backup"` and the scripts aim at it |
| `verify-v04-p2`, `verify-v04-p3-p4` | word audio moved to the optional `media.pack` | **right.** `audio_blobs JOIN audio WHERE kind='word'` = 0 rows in `content.db`, 9,991 in `media.db` | both install the media pack through the real UI first, via the shared [media.mjs](media.mjs) |

`verify-v06` is the one that does not pass here, and it is a **data prerequisite, not a defect**:
`build/staging.db` is gitignored, so a clone that has only run `seed:all` holds the seeded VOA
archive and nothing from the `daily:*` modules. The script now says exactly that instead of
failing with "expected daily content in all three languages", which read like a regression.
Run `pnpm ingest daily:all` and rebuild the pack to make it pass.

**Two scripts were machine-specific and are not any more.** `verify-upgrade-v02-to-v03` hardcoded
pack versions `2026.07.30-1`/`-5`, which exist only on the machine that built them — a bare
`ENOENT` anywhere else. It now derives the pair from pack CONTENT (newest with `graphemes = 0`,
newest with `graphemes > 0`), which is what its assertions actually depend on, and names the
missing prerequisite when no such pair exists. `verify-v04-p1` still used
`readdirSync().sort().at(-1)` — the v0.7 stale-pack trap that `newestPack` was written to kill;
it imported the helper and never called it.

⚠️ **Runner matters.** The pre-v0.9 scripts hardcode `http://localhost:5173` in their
off-origin allow-list (e.g. `verify-v05-p1-p2.mjs:88`), so they must run against `pnpm dev`;
only `verify-v09` and `verify-upgrade-v02-to-v03` need the static server. Running the old ones
at `MLS_BASE=…:5199` reports the server's own URLs as "off-origin", which looks like a product
bug and is not one.

## What each one proves

| Script | Version | Proves |
|---|---|---|
| `verify-v02.mjs` | 0.2 | FSRS intervals advance under the debug clock; user.db export/import round-trips |
| `verify-import-guard.mjs` | 0.2 | a valid-SQLite-but-not-a-backup file is rejected with progress intact |
| `verify-v03-p2.mjs` | 0.3 | the packed stroke data is *usable*: the quiz is completed by replaying each character's own medians as pointer events |
| `verify-v03-p3.mjs` | 0.3 | grapheme cards run through the same SRS loop (2 d → 16 d) |
| `verify-v03-p4.mjs` | 0.3 | all 1,707 pinyin syllables reachable; audio decodes from a `blob:`; 0 off-origin requests |
| `verify-v03-p4b.mjs` | 0.3 | the tone drill hides its prompt, scores once, and offers four contrasts |
| `verify-v03-p4c.mjs` | 0.3 | 51 IPA diagrams render from `data:` URLs with no inline `<svg>` |
| `verify-v03-p4d.mjs` | 0.3 | é traces end-to-end through the same component that draws hanzi |
| `verify-v04-p1.mjs` | 0.4 | every card carries a real credited example, frozen into its snapshot |
| `verify-v04-p2.mjs` | 0.4 | words play a decodable human recording out of the pack |
| `verify-v04-p3-p4.mjs` | 0.4 | French Lingua Libre audio + the TTS fallback, incl. late-arriving voices and per-clip credit |
| `verify-v05-p1-p2.mjs` | 0.5 | the grammar reader: HSK-2 得 offline, Tex with audio, and every "learn more" link fetched to prove it resolves |
| `verify-v06.mjs` | 0.6 | the daily pull: pulling twice does not duplicate, a dying source degrades to a partial report, and the word of the day reaches the SRS deck |
| `verify-v07.mjs` | 0.7 | the tech module: zh labels all simplified, no English-as-Vietnamese, no disambiguation QIDs (live-sampled), 固件 finds Firmware, and the tech card reviews with its labels |
| `verify-v08.mjs` | 0.8 | stats+forecast: attested cognates (大学=đại học, 手机 has NONE), dashboard denominators equal the pack, the FSRS simulator is deterministic and lands in the 8-12× band, and the reach date matches the arithmetic |
| `verify-v09.mjs` | 0.9 | the media split (core holds no word blobs, media holds exactly them, no reference dangles across the pair, sampled blobs are real mp3), an in-place upgrade from a v0.8-format pack, media-absent → labelled TTS + nudge, media-installed → the recording plays, webmanifest + service-worker control, and a full offline session (needs `static-server.mjs`) |
| `verify-v10-live.mjs` | 1.0 | the DEPLOYED site (GitHub Pages, base `/multilingual-studies/` — a path no local script runs at): packs served next to the shell, a cold deep link boots through Pages' `404.html` fallback and the router resolves it, the SW takes control, 0 off-origin. Needs nothing local — it drives the public URL (`MLS_LIVE` to point elsewhere) |
| `verify-ux.mjs` | 1.0 | the four reported UX defects: the current tab is lit with `aria-current` (and a nested route keeps its parent lit) · **0px page overflow at 360–1280** with the lit tab scrolled into view · every screen opens with exactly one real `.screen-intro` in BOTH languages · **no screen claims "no data" before its query answers** (asserted with a SEEDED deck — with an empty deck the message is simply true) · no IPA chip overflows, overlaps or duplicates another · **vi.json/en.json key parity**, which nothing else in the suite checked |
| `verify-backup-honesty.mjs` | 1.0 | the app never claims a backup it cannot confirm: an UNCONFIRMED export snoozes a day and is not recorded as a backup (checked by cancelling the download, then fast-forwarding the debug clock), a confirmed one buys the full week and then expires, a FAILING export reports itself instead of dying as an unhandled rejection, and a REFUSED durable-storage request says so instead of looking like a no-op |
| `verify-upgrade-v02-to-v03.mjs` | 0.3 | an in-place pack upgrade preserves all SRS state (needs `static-server.mjs`, not `pnpm dev`). The pack PAIR is derived from content, not hardcoded, so it runs on any machine that has one pre-v0.3 and one v0.3+ pack |
| `audit-v04-fixes.cjs` | 0.4 | data-level audit of the sentence corpus (no browser; reads `build/staging.db`) |

`static-server.mjs` serves `apps/web/dist` with no file watcher — required for the upgrade test,
because Vite's watcher dies when `content.pack` is swapped underneath it on Windows.
`probe-*.mjs` and `smoke-*.mjs` are one-off debugging aids kept for reference, not acceptance.

## Traps these scripts encode

Every one of these cost real debugging time; HANDOFF's "Testing recipe" section has the full list.

- Don't assert on `ul.words li` right after typing — the previous query's rows linger through the
  150 ms debounce. Wait for the expected headword.
- **Poll, don't sample once.** Screens that refresh asynchronously (review counters, an audio
  element that has just started) read stale on a single check, and fail under load in a way that
  looks like a product bug.
- Navigate in-app (`page.click` on a nav link), not with `page.goto`, once the app is loaded — a
  fresh document load can lose the exclusive OPFS handles.
- A fresh `browser.newContext()` gets an empty OPFS, so every run re-installs the pack and starts
  from an empty `user.db`. That is what makes the SRS runs repeatable.
- **A stub kinder than the real API is a test that passes for the wrong reason** — the
  `speechSynthesis` stub in `verify-v04-p3-p4.mjs` must start with an empty voice list and deliver
  voices via `voiceschanged`, the way Chrome actually does.
- **Audio playback delays document teardown.** A page that has played a clip keeps the SQLite
  pool's exclusive OPFS handles for ~20 s past a reload, so anything that plays then reloads is
  really testing the storage-lock recovery path. `verify-v09.mjs` does this deliberately.
- **`vite build` empties `dist/`**, packs included. Re-publish (or re-copy) `manifest.json`,
  `content.pack` and `media.pack` into `apps/web/dist/packs/` after every build, or the static
  server serves whatever stale pack `public/packs/` happened to hold.
- Derive the off-origin allow-pattern from `BASE`, never a hardcoded port — these scripts run on
  5173 (dev) and 5199 (static server).
- **`:first-of-type` is scoped to an element's OWN parent**, so a DESCENDANT selector like
  `.backup button:first-of-type` silently gains matches the day anyone nests a button inside the
  container — and `page.click()` is non-strict, so it takes the first in document order and says
  nothing. Three scripts spent a version clicking the wrong button. Anchor on a class that names
  the intent. `verify-v03-p2.mjs:103` (`.decomposition a:first-of-type`) carries the same latent
  trap.
- **`page.waitForFunction(fn, {timeout})` is a 2-arg call**: Playwright's signature is
  `(fn, arg, options)`, so the options object is passed as the ARG and the timeout silently falls
  back to the 30 s default. Measured: a wait written for 2 s took 30 s. Always pass `null`
  explicitly. `verify-v09` was the only offender left; the check is `grep -n waitForFunction`.
- **Machine-specific data is machine-specific coupling.** `paths.mjs` removed hardcoded repo and
  Chrome paths, but `verify-upgrade-v02-to-v03` still named two pack VERSIONS that only ever
  existed on one machine. Derive what a script needs from what a pack contains, and when the
  prerequisite is genuinely missing, fail with the command that fixes it — `verify-v06` now names
  `pnpm ingest daily:all` instead of implying the daily pull is broken.
- **A test that has never been seen RED proves nothing.** `verify-backup-honesty` was run against
  a deliberately reverted `onExport` and failed on the exact assertion it exists for, before it
  was believed.
