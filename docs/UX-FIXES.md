# UX fixes — four reported defects, and the three worse ones underneath them

> **✅ ALL FOUR PHASES SHIPPED 2026-08-03** — commits `8cbe01d` (A), `110f4ef` (B), `4c4e13a`
> (C), `2891181` (D), `4afe498` (e2e repair). Backed by `tools/e2e/verify-ux.mjs`. Measured
> after: 0px page overflow at every width (was 219px at 390px), 51 IPA chips all distinct (was
> 13 ambiguous), no screen claims "no data" while loading, every screen opens with one real
> sentence in both languages, and vi/en key parity is now enforced at 234 keys.
> The plan below is kept as written — including the corrections the verify pass caught — because
> the reasoning is the record.

> **TL;DR (tiếng Việt):** Bốn vấn đề người dùng báo (không biết đang ở tab nào · không có hướng
> dẫn ngắn · đang tải thì màn hình trắng · bảng IPA tràn chữ) đều sửa được, tổng cộng khoảng
> **một buổi làm việc**. Nhưng khi đo trên code và trên Chrome thật, mỗi vấn đề lại lộ ra một
> lỗi **nặng hơn** nằm bên dưới: app **nói dối** là "không có dữ liệu" trong lúc đang tải;
> trên điện thoại **4 tab cuối không bấm tới được**; và bảng IPA có **hai cặp nút giống hệt
> nhau** mà CSS không cứu được. Thứ tự nên làm: A (nói thật) → B (điều hướng) → C (IPA) → D
> (hướng dẫn).

Written 2026-08-03 after a user reported four UX problems with screenshots. Every claim below
was measured against the code or the shipped pack, then adversarially re-checked (8 agents,
4 audit + 4 verify). Findings the verifier corrected are marked ⚠.

---

## What the user reported, and what is actually wrong

| # | Reported | Root cause | The worse thing underneath |
|---|---|---|---|
| 1 | No highlight on the current tab | `<Link>` never gets an active class ([app.tsx:66-77](../apps/web/src/app.tsx#L66-L77)) | **On a 390px phone the page scrolls sideways 219px and the last 4 tabs are unreachable** |
| 2 | No short guide per screen | An unenforced convention: 5 screens have it, 5 do not | — |
| 3 | Blank frame while loading | 9 screens render a bare `…`; **6 render an "empty" message from `[]` before the query resolves** | **`/review` tells a user with cards that their deck is empty** |
| 4 | IPA chips overflow | 7 of 51 glyphs are words, in a 58px track | **13 buttons across 6 groups are visually identical** |

**The ordering principle:** an app that says *"Không có chữ nào cho lựa chọn này"* while it is
still loading is not merely unpolished — it is **stating something false**. That is the same
standard this project applies to its data (a gap ships as a gap, a TTS label never lies), so it
gets fixed first.

---

## Phase A — Stop the app claiming "no data" while it is loading

**The defect.** Six routes initialise list state to `[]` and treat emptiness as "there is
nothing here", so the genuine empty-state message renders during the very first query:

| Route | Line | What it wrongly says while loading |
|---|---|---|
| write.tsx | 124 | "Không có chữ nào cho lựa chọn này" — **this is the user's screenshot** |
| review.tsx | 279 | "Bộ thẻ đang trống" — `[].every()` is vacuously true, so **a user with cards sees this** |
| browse.tsx | 88 | "browse.noLevels" |
| today.tsx | 170 | empty daily list |
| grammar.tsx | 93 | empty topic list |
| tech.tsx | 111 | empty term list |

The pattern for doing it right already exists in this codebase and is simply not applied
uniformly: `ipa.tsx:20`, `pinyin.tsx:31` and `tones.tsx:20` use `T[] | null`, and the detail
pages use a `'loading'` literal. `today.tsx:47-50` even carries a comment explaining this exact
bug class.

**The fix.**
1. Convert the six routes to `T[] | null`, where `null` means *not loaded yet* and `[]` means
   *genuinely empty*. Render the empty message only on `[]`.
2. ⚠ **Every null sentinel needs a failure path.** Without `setRows([])` in the `catch`, a
   failed query turns a wrong-but-terminal message into a **permanent spinner**. `write.tsx:46-48`
   catches but only sets `tooOld`; `browse.tsx:23,30`, `grammar.tsx:61-63`, `today.tsx:78-91`,
   `review.tsx:72` and `licenses.tsx:13` have **no catch at all**.
3. A shared `<Loading />` component (spinner + a translated "Đang tải…") replacing the bare `…`
   at nine sites: glyph:60, grammar:126, ipa:65, pinyin:81, stats:107, tech:160, **today:260**
   (⚠ missed by the first pass), tones:87, word:72 — plus the app-level loader at app.tsx:90.
4. ⚠ **`app.tsx:91` must keep its `t()` options.** The real call is
   `t(\`db.phase.${phase}\`, { defaultValue: t('db.loading'), mb: db.status.mb ?? '…' })` —
   dropping `defaultValue` renders a raw key; dropping `mb` breaks `{{mb}}` in `db.phase.download`.
5. ⚠ **Do not touch `today.tsx:129`.** Its literal `…` is load-bearing for
   `verify-v06.mjs:137-147`, whose predicate is `textContent !== '…'`. Either leave it, or give
   the date line its own class and retarget both lines of the test in the same commit.
6. ⚠ Typecheck: paginated updaters need `[...(r ?? []), ...next]` (write.tsx:61, browse.tsx:49).

**Why the queries are genuinely slow (so a spinner is honest, not decoration):** every query is
a serial `postMessage` RPC into a worker running `selectObjects` synchronously
([sqlite.worker.ts:606-609](../apps/web/src/db/sqlite.worker.ts#L606-L609)) over a ~56 MB
OPFS-backed database; the worst screens issue 6–13 of them back to back.

New i18n key: `ui.loading` (both files). Effort: ~26 sites, most trivial. **Highest priority.**

---

## Phase B — Make the current tab visible, and the far tabs reachable

**The reported half.** [app.tsx:66-77](../apps/web/src/app.tsx#L66-L77) uses `<Link>`, which can
never carry an active class, and the global `a { color: var(--accent) }` paints all twelve links
the same green — so even a subtle cue would be invisible.

**The half nobody reported.** `header.top nav` (styles.css:25) is `display:flex` with **no wrap
and no overflow**. Measured in Chrome with the real Vietnamese labels: the strip is intrinsically
**593px inside a 358px column at 390px width**, so the *whole page* scrolls sideways by 219px,
every label shreds across up to 3 lines ("Duyệt / từ / vựng" — visible in the user's own
screenshot), and **the last four tabs are off-screen with no scroll affordance**. For an app
whose entire v0.9 was "install it on your phone", four unreachable tabs is the more serious bug.

**The fix.**
1. `<NavLink>` for the eleven non-root tabs. With a string `className`, NavLink appends the
   literal class `active` — exactly the class `.chips button.active` and `.ui-lang button.active`
   already use — and sets `aria-current="page"` for free. **No `end` prop**: the non-end match is
   what keeps the parent tab lit on `/write/:glyph`, `/grammar/:id`, `/today/:id`, `/tech/:id`.
   Prefix collisions are impossible (the router requires a `/` boundary, so `/tones` cannot light
   `/today`).
2. The search tab stays a plain `<Link>` with a hand-computed
   `pathname === '/' || pathname.startsWith('/word/')`. It must be `Link`, not `NavLink`, because
   NavLink drops `aria-current` when its own `isActive` is false — a NavLink version would
   highlight the tab visually while lying to a screen reader. ⚠ Honest caveat to put in a
   comment: word pages are reached from Browse, Review, Today and glyph pages too, so lighting
   Search there is a deliberate approximation — better than no tab lit at all.
3. Style: an **accent underline**, not a filled pill (twelve filled pills would dominate the
   header). `color: var(--fg-soft)` inactive → `var(--accent)` + `border-bottom` + `font-weight:600`
   active. Contrast measured: 5.7:1 light, 6.5:1 dark — AA in both themes. Cue is
   non-colour-redundant (weight + rule + `aria-current`).
4. Turn the nav into a single-line horizontal scroller (`flex: 1 1 100%`, `overflow-x: auto`,
   edge mask as the affordance) with `white-space: nowrap` on the links to stop label shredding.
   ⚠ Add a comment that `overflow-x: auto` is *what releases* the 593px min-content floor —
   a later "cleanup" moving overflow to a wrapper silently restores the 219px page overflow.
   ⚠ Move `.ui-lang` before the nav in the DOM, or the header grows to a third row.
5. Auto-centre the active tab on every path change (the strip is still ~1103px wide, so the lit
   tab is often off-screen on arrival). Use rect-based `scrollBy`, **not** `offsetLeft` (the nav
   is unpositioned, so `offsetParent` is `<body>`) and **not** `scrollIntoView` (it would scroll
   the page vertically). Keep it instant — smooth animation makes Playwright wait for stability
   across 50+ nav clicks. ⚠ Null-guard: the header renders outside the `state === 'ready'` gate.
6. ⚠ **Blocker in the first draft:** `useRef` is never imported — `app.tsx:1` is
   `import { useEffect } from 'react'`. `pnpm -r typecheck` would fail with TS2304.

**E2E: no breakage.** All 32 nav call sites in the suite are href-based, and NavLink still emits
a plain `<a href>`. The only `.active` assertions are scoped to `.chips button`.

Open question worth one decision: `scrollbar-width: none` removes the only scroll *control* for
mouse users, and the strip overflows on desktop too. `scrollbar-width: thin` under
`@media (pointer: fine)` would be this file's first non-theme media query.

---

## Phase C — Make every IPA chip readable *and* distinguishable

**Measured in the shipped pack:** 44 of 51 glyphs are a single character, but seven are words —
`voiceless` ×2, `pulmonic` ×2, `creaky`, `murmur`, `modal`. `button.phone-btn` is a single-child
flex row with no `min-width:0` and no overflow guard, and a word has no break opportunity, so at
1.35rem its ~100px min-content contribution paints straight out of the ~61px chip into its
neighbour. That is the user's screenshot.

⚠ **The bigger half the screenshot only hints at.** There are **six duplicate-glyph groups
covering 13 buttons**: `ǃ`×3, `s`×2, `z`×2, `ʃ`×2 (apical vs laminal), `voiceless`×2,
`pulmonic`×2. The four consonant collisions are **correct IPA** and can never be fixed in data —
so the chip needs a disambiguating caption from `notes_md` regardless of any layout fix.

**The fix.**
1. CSS: `min-width: 0` + overflow guard on the chip; a smaller font for multi-character labels
   (⚠ specificity: `button.phone-btn .glyph` is (0,2,1), so a bare `.glyph.word` at (0,2,0)
   loses — scope it properly); widen the grid track for groups that need it. ⚠ **Widen on
   captions too, not just words** — otherwise the caption "2. rarefaction" re-creates the same
   overflow on the 58px click chips it exists to disambiguate. Alternative: shorten the tag to
   "1"/"2"/"3" and keep the phrase in `title`.
2. Vietnamese names for the seven word glyphs via `t(key, packFallback)` — the codebase's own
   precedent at `ipa.tsx:81`. Seven new `ipa.phone.*` keys in **both** JSONs.
3. ⚠ Gate the duplicate caption on `!isWord && dup.has(glyph)`, or `pulmonic` gets doubled
   disambiguation (label "luồng hơi phổi 1" above a caption "1").
4. ⚠ **A11y:** do not set `aria-label={name}` on the word chips — it overrides element contents,
   so the chip would *show* Vietnamese and *announce* raw English (WCAG 2.5.3 Label-in-Name
   failure, and it silently reverses the Vietnamese-first rule for AT users). Compose it, or use
   `aria-label` only on the nine duplicate consonants.
5. ⚠ **Dark-mode override must be placed strictly after styles.css:186** — media queries add no
   specificity, so an equal-specificity rule placed earlier silently loses.

**View fix, not data fix.** The glyph values come from
[sagittal.ts:87](../apps/ingest/src/sources/shared/sagittal.ts#L87). Changing them means a
re-seed, a pack rebuild and an ID-churn check. IDs are keyed on the filename stem, so a data fix
*would* stay clean — but it cannot help the four consonant duplicates, which are correct IPA.
Fix the view; treat the data as optional later.

---

## Phase D — One honest sentence per screen

Five screens already open with `<h2>` then `<p className="hint">` (write:71, pinyin:87, tones:93,
ipa:77, tech:92). Browse, review, grammar and today never adopted it; stats has three per-section
hints but nothing saying what the screen *is*. So this is an unenforced convention, not a missing
mechanism — apply the existing pattern plus one `.screen-intro` rule for consistent rhythm.

Six new keys: `browse.intro`, `review.intro`, `grammar.intro`, `today.intro`, `stats.intro`,
`stats.emptyDeck`.

⚠ **Three corrections the verifier caught in the draft copy:**
1. The proposed `stats.emptyDeck` predicate only measures `zh/en/fr` (`stats.tsx:32`), so a
   learner whose deck holds only **tech** cards would be told "Bộ thẻ đang trống" while `/review`
   simultaneously shows them a Tech deck with cards. On a screen whose own docblock argues
   against flattering lies, that is the wrong sentence. Either reword to what the predicate
   actually measures, or compute real emptiness first.
2. The proposed `review.intro` says "Bấm Bắt đầu" but renders in **both** overview branches —
   including the empty-deck branch (review.tsx:288-291) where there is no Start button. Gate it.
3. ⚠ **Nothing guards a missing translation.** `i18n/index.ts` is the only consumer of the JSONs,
   there is no key-parity check anywhere, and no e2e script asserts on any intro line — so a key
   that lands in `vi.json` but not `en.json` ships the literal string `browse.intro` to EN users
   and **every script still passes**. Add the parity check as part of this phase.

`/review` already has a good empty state and should not be touched.

---

## Acceptance

CLAUDE.md requires a `tools/e2e/` script behind every claim. This work needs:

- **`verify-ux.mjs`** (new): the current tab carries `.active` + `aria-current` on each route
  and on a nested route; no chip overflows (`scrollWidth > clientWidth` count is 0 — the actual
  defect, currently unasserted anywhere); no screen renders an empty-state message before its
  first query resolves; every screen shows exactly one `.screen-intro`.
- **Key parity** (node-side, cheap): every key in `vi.json` exists in `en.json` and vice versa.
- ⚠ Navigate by clicking nav links, never `page.goto` once loaded (tools/e2e/README.md:79), and
  use suffix selectors (`nav a[href$="/grammar"]`) so the script also runs against the deployed
  base path.
- Bookkeeping: HANDOFF "Verified/Script" line, and the e2e README's "All 18 pass" count.

## Effort

| Phase | Sites | Estimate |
|---|---|---|
| A — loading truthfulness | ~26 (most trivial) | 2–3 h |
| B — nav | ~10 | 1–2 h |
| C — IPA | ~13 | 1–2 h |
| D — guidance | ~13 | 1 h + copy |
| Acceptance script + docs | — | 1–2 h |

About one working session. Phases are independent and can land as separate commits; A first,
because it is the only one where the app currently tells the user something untrue.
