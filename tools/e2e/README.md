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
# The upgrade test is the one exception — it swaps the pack file underneath the app, so it needs
# the static server rather than `pnpm dev`. Running it in this loop always "fails".
for s in verify-*.mjs; do
  case "$s" in verify-upgrade*) continue;; esac
  printf '%-30s ' "$s"; node "./$s" >/dev/null 2>&1 && echo PASS || echo FAIL
done

# then, for the upgrade test:
pnpm --filter @mls/web build && node static-server.mjs &
MLS_BASE=http://localhost:5199 node ./verify-upgrade-v02-to-v03.mjs
```

All 15 pass on v0.7.

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
| `verify-upgrade-v02-to-v03.mjs` | 0.3 | an in-place pack upgrade preserves all SRS state (needs `static-server.mjs`, not `pnpm dev`) |
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
