# HANDOFF — continue the work from any machine

> **TL;DR (tiếng Việt):** Dự án đang ở **v0.3** (đã xong, đã tag — **hệ chữ viết**).
> Xem 好 tự viết rồi tự tô · tô chữ `é` · nghe đủ 1.707 âm tiết pinyin · luyện thanh điệu ·
> bảng IPA có hình cắt dọc · thẻ tập viết chạy chung vòng ôn SRS của v0.2.
> Việc tiếp theo là **v0.4** — xem [docs/PLAN.md](docs/PLAN.md).
> Trên máy mới: `pnpm install` → `pnpm ingest seed:all` → `pnpm pack:build` → `pnpm ingest pack publish` → `pnpm dev`.

Keep this file current: update the **Current state** and **Next up** sections at the end of every
working session, and commit it with the session's push. It is the single source of truth for
"where were we?" on a fresh clone.

## Current state (updated 2026-07-30)

- **v0.3 shipped & tagged** — "Writing systems". Built in seven committed phases (P1–P4d), each
  verified in headless Chrome before the next started. Pack `2026.07.30-5`: 147,261 words,
  **11,254 graphemes** (9,432 hanzi + 1,707 pinyin syllables + 51 IPA phones + 64 Latin letters),
  1,707 audio clips, 51 sagittal diagrams, 14 sources, **47.5 MB gz**.
  Every roadmap clause for 0.3 is met: *watch 好 draw itself and trace it · trace é · hear every
  pinyin syllable*.
  - **P1 done — hanzi stroke data in the pack.** `seed:zh-strokes`
    ([apps/ingest/src/sources/zh/strokes.ts](apps/ingest/src/sources/zh/strokes.ts)) ingests
    makemeahanzi `graphics.txt` (Arphic PL) → `graphemes.stroke_json` for **9,432 characters**
    and `dictionary.txt` (LGPL-3.0+) → a **separate `hanzi_info` table** (definition, pinyin,
    IDS decomposition, radical, etymology). Two licenses ⇒ two `sources` rows ⇒ two tables;
    never merge them. `graphemes.reading` is filled from CC-CEDICT single-char entries (already
    bundled) so the APL table carries no LGPL data. `graphemes.ord` = stroke count.
  - Coverage: **HSK 1 through 7-9 have 0 characters missing stroke data.** 4,959 of the 14,391
    distinct characters in CEDICT content have no upstream stroke data (rare glyphs) — expected,
    not a bug. Only characters present in our words are ingested (142 upstream glyphs dropped).
  - `pack verify` gained the v0.3 gates: no `kind='hanzi'` row without `stroke_json`, every HSK1
    character present, no orphan `hanzi_info`, and **ARPHICPL.TXT must exist** in
    `apps/web/public/licenses/` whenever Arphic data is bundled. The seed writes that file; it
    is committed, and shipping it unaltered is a condition of the license.
  - **Pack grew 27.7 MB → 41.2 MB gz** (76 MB → 117 MB raw) — stroke JSON is 30.2 MB of it.
    Accepted deliberately: strokes for every lookup-able word beat a smaller download. Lever if
    it ever needs trimming: restrict the seed to HSK + top-N frequency (~3k chars, ≈ −9 MB gz),
    or split strokes into an optional second pack.
  - The **ID-churn gate ran for real for the first time** (two pack dirs now exist in
    `build/packs/`) and reported **0 vanished word IDs** across the schema change.
  - **P2 done — you can watch 好 draw itself and trace it.** `hanzi-writer@3.7.3` (MIT) is
    wrapped by [stroke-writer.tsx](apps/web/src/components/stroke-writer.tsx); its
    `charDataLoader` returns the JSON we already hold, so it **never touches the network**.
    New routes: `/write` (browse by HSK level or by stroke count) and `/write/:glyph`
    (animate · trace · reveal, reading, radical, definition, IDS decomposition whose
    components are links when we have their strokes, and the words the character appears in).
    Characters in a word page's headword now link into `/write/:glyph` — the discovery path.
  - Verified in headless Chrome: the trace quiz was driven with **real pointer events replayed
    along the character's own medians** and completed 6/6 with zero mistakes, proving the
    packed stroke data is usable and not just present. Licenses screen lists Arphic PL + LGPL
    and `/licenses/ARPHICPL.TXT` serves the 6,900-byte text. 0 console errors.
    Script: `scratchpad/e2e/verify-v03-p2.mjs` (it reads medians from the built pack itself and
    inverts hanzi-writer's Positioner — bounds `(0,-124)..(1024,900)` — to hit real coordinates).
  - **Fixed a real navigation bug found on the way** (see the storage-lock note below).
  - **P3 done — writing cards go through the v0.2 SRS loop.** ＋ on `/write/:glyph` creates a
    card keyed on the **grapheme ID** (`zh:g:mmah:好`) in the same `cards` table, scheduled by
    the same FSRS engine, counted in the same per-language due/new budgets. `CardSnapshot`
    gained two **optional** fields — `kind: 'word' | 'grapheme'` and `strokeJson` — so every
    card written by v0.2 still passes import validation; absent `kind` means `'word'` (helper
    `snapshotKind()`). The stroke data is frozen into the snapshot, so a review renders the
    writer **without joining content.db** (invariant 6).
  - In `/review`, a grapheme card shows the glyph as the prompt and the interactive writer on
    the answer side (recall first, then practise); word cards are untouched, and the footer link
    points at `/write/:glyph` instead of `/word/:id`.
  - Verified: mixed deck of one word card + one grapheme card in a single session; the writer
    appears only on the grapheme card; FSRS advanced it **2 d → 16 d** under a +4 d debug clock
    (the same growth v0.2 measured for words); export → import round-tripped a user.db
    containing a grapheme card. 0 console errors. Script: `scratchpad/e2e/verify-v03-p3.mjs`.
  - **P4a done — hear every pinyin syllable.** `seed:zh-pinyin-audio` ingests all **1,707**
    Mandarin syllable recordings from `hugolpz/audio-cmn` (CC BY-SA, Chen Wang, via the dead
    Shtooka project's mirror). At the `24k-abr` encoding the whole chart is **7.5 MB**, so it
    ships **inside the content pack** — the separate audio pack this file previously suggested
    turned out to be unnecessary. Bytes live in a new `audio_blobs` table beside `audio`
    (metadata is scanned constantly by `pack verify`; blobs are only fetched one at a time).
  - `/pinyin` renders the classic initials × finals grid per tone (39×24 for tones 1–4, 14×2 for
    the 19 neutral-tone syllables); clicking a cell plays the clip from a Blob URL.
    [audio/player.ts](apps/web/src/audio/player.ts) caches one object URL per clip — creating one
    per click leaks them.
  - Verified: all **1,707** syllables are reachable across the five tone tabs, hǎo decoded to a
    1.28 s clip from a `blob:` URL, and **zero off-origin requests** were made (the whole feature
    is offline). Script: `scratchpad/e2e/verify-v03-p4.mjs`.
  - Pack: 41.2 → **47.4 MB gz** (mp3 is already compressed, so it adds close to its raw size).
  - Two ingest traps fixed here, both worth remembering:
    - GitHub's **contents** API silently caps a directory listing at 1,000 entries *and* ignores
      `page`, so it reported 1,000 of the 1,707 files and re-served the same page. Use the **git
      trees API** (`/git/trees/{ref}?recursive=1`) and check its `truncated` flag.
    - `alreadyIngested()` keys on the input hash, so fixing a **parser** leaves the database
      stale — the seed just skips. `zh-pinyin-audio` folds a `PARSER_VERSION` into the ingest
      hash (but *not* into the lock hash, which must only move when upstream moves). Any seed
      whose parsing is non-trivial should do the same.
  - **P4b done — tone listening drill.** `/tones` plays a syllable, hides it, and asks which of
    the four tones it was; after answering it reveals the tone-marked form, marks the right and
    wrong buttons, and offers all four variants side by side to hear the contrast. Only the
    **421 bases that carry all four tones** are drilled — a partial set would give the answer
    away. Score + streak are in-memory only (deliberately: this is a warm-up, not SRS).
  - Verified: prompt hidden until answered, right/wrong both scored, exactly one button marked
    correct, four distinct contrast variants, answering twice cannot re-score, 0 off-origin
    requests, 0 console errors. Script: `scratchpad/e2e/verify-v03-p4b.mjs`.
  - **P4c done — IPA chart + sagittal diagrams.** `seed:ipa-sagittal` ingests all **51** CC0
    vocal-tract SVGs from `drammock/phonetics-teaching-assets` (Richard Wright & Dan McCloy) as
    `lang='all'`, `kind='ipa_phone'` graphemes whose `diagram_ref` points into a new generic
    **`asset_blobs`** table. The filename→phone map in the seed is **explicit on purpose**:
    upstream encodes variants (`s_apical` vs `s_laminal`, the 3-frame click `kǃ_1..3`) that no
    rule recovers, and a silently wrong IPA symbol is worse than a missing one. IDs key on the
    filename stem, since apical/laminal variants share one symbol and would otherwise collide.
    (Upstream ships no `ʒ_laminal` — ʃ/s/z have both variants, ʒ only apical.)
  - `/ipa` groups the phones into consonants / vowels / glottis states / airstream and shows the
    selected diagram. Diagrams render as **`<img src="data:image/svg+xml,…">`, never injected as
    markup** — an SVG inside `<img>` cannot execute scripts, so no sanitiser is needed even if
    upstream art changes. They sit on a white surface in **both** themes: inverting line art
    would flip the anatomical shading and mislead.
  - `pack verify` now also fails on **dangling media**: a grapheme pointing at an `audio_id` with
    no blob, or at a missing `diagram_ref` asset.
  - Verified: 51 buttons in 4 categories, apical/laminal kept distinct, four diagrams decoded at
    654×925 from `data:` URLs, no inline `<svg>` in the DOM, CC0 authors credited on the Licenses
    screen, 0 off-origin requests, 0 console errors. Script: `scratchpad/e2e/verify-v03-p4c.mjs`.
  - Pack: 47.4 → **47.5 MB gz** (13 sources, 11,190 graphemes).
  - **P4d done — trace é.** The last clause of the 0.3 roadmap row. **64 Latin glyphs**
    (a–z, A–Z, and é è ê ë à â ù û ô î ï ç) authored in
    [latin.ts](apps/ingest/src/sources/shared/latin.ts) as parametric stroke skeletons, then
    converted to hanzi-writer records: each centreline is offset by ±46 units into a **closed
    outline** with rounded caps, and the authored centreline *is* the median, so tracing follows
    exactly the path the animation draws.
  - **Why authored rather than derived from Relief SingleLine**, contradicting the original plan:
    hanzi-writer clips a thick animated line against the `strokes` paths, so a single-line font's
    centrelines would clip to nothing — an offsetting step was unavoidable either way. Once you
    are offsetting anyway, authoring is both simpler and better: stroke *order and direction* are
    the entire point of a tracing drill, and a font encodes neither. Result: original work under
    the pack's own CC BY-SA 4.0, and no OFL obligations enter the pack. Accented forms compose
    (base strokes then the mark; i/j drop their tittle first), so 26 letter definitions plus five
    marks yield all 38 lowercase forms.
  - `/write` gained a script toggle (Hán tự / Chữ Latin). Chip rows now carry stable classes
    (`.chips.script`, `.chips.levels`, `.chips.strokes`) — positional selectors broke a test when
    a row was inserted above them.
  - Verified: all 64 glyphs listed, é is 2 strokes (e body then acute, acute above the body),
    **traced end to end with 0 mistakes** through the same component that draws hanzi, and added
    to the SRS deck. Script: `scratchpad/e2e/verify-v03-p4d.mjs`.
  - **Two real bugs this phase surfaced**, both fixed:
    - `graphemes.ord` means stroke count for hanzi but teaching order for letters, so the glyph
      page showed "é — 26 nét". Stroke count is now counted from `stroke_json` itself; never
      display `ord` as a stroke count.
    - Letters and IPA phones are `lang='all'`, but `/review` only queued `zh|en|fr` — a Latin
      writing card could be added and would then **never come up for review**. `'all'` is now a
      first-class deck ("Chữ viết chung" / "Writing systems"). Any future `lang='all'` content
      inherits this; adding a new content lang means adding it to `LANGS` in `review.tsx` too.
  - Small UX wart noticed, not fixed: clicking "Ôn tập" in the nav while the done screen is up
    leaves `phase='done'` (the route doesn't change, so nothing remounts). The done screen's own
    back button works. Worth a `useEffect` on location if it annoys.
- **v0.2 shipped & tagged** — "Daily review loop":
  - `user.db` (SRS state) lives in the browser's OPFS **beside** the content pack, in the same
    `mls-pool` SAH pool, same worker — the pack-update path never touches it. Schema (cards /
    append-only `review_log` / settings / daily_stats) + migrations live in
    `packages/shared/src/srs/schema.ts`; `USER_SCHEMA_VERSION` derives from the migration list.
  - `ts-fsrs@5.4.1` wrapper in `packages/shared/src/srs/fsrs.ts` (subpath `@mls/shared/srs`) —
    pure functions, explicit `now`, cards cross as plain field objects = `cards` columns.
  - Add-to-deck ＋ buttons on browse rows + word pages; cards key on **raw word IDs** and carry
    a `snapshot` JSON (headword/reading/glosses/level) so they survive pack swaps.
  - `/review`: per-language due/new counts, per-language new-card budget (default 5/day,
    `settings.new_per_day.<lang>`), session with Again/Hard/Good/Easy + interval previews,
    learning-step cards loop within the session, daily stats + streak, done screen.
  - user.db export/import buttons on `/review`. Import validates on a scratch pool copy FIRST
    (header, integrity, `user_version` ∈ [1..N] **before** migrating, 4 tables, Zod-checked
    snapshots), keeps a persistent `/user-backup.db`, and restores on any failure.
  - Debug clock for verification: `localStorage.setItem('mls_debug_clock_offset_ms', String(3*864e5))`
    + reload = +3 days; a red ⏱ badge shows on `/review` while active.
  - Verified end-to-end in headless Chrome: FSRS interval grew 2d → 16d under a +4d offset;
    export → mutate → import rewound state; non-backup SQLite files rejected with progress intact.
  - Hardening from the adversarial review: worker falls back to the installed pack when the
    manifest fetch OR the pack download/verify fails offline; re-entrancy guards on rating /
    add-to-deck / load-more; budget input commits on blur; back-link and double-URI-decode
    bugs inherited from v0.1 fixed.
- **v0.1 shipped & tagged** — "Three real dictionaries in the browser":
  147,261 words / 171,479 senses / 9 sources, pack `2026.07.29-2` at 27.7 MB gz.
  - ZH: full CC-CEDICT + HSK 2.0/3.0 levels (11,430 words) + OpenSubtitles freq ranks
  - EN: 8,648-word CEFR backbone (CEFR-J + Octanove) + WordNet glosses + ipa-dict IPA + freq
  - FR: 15,000 Lexique lemmas + **derived** CEFR bands (see PLAN — no redistributable FR list exists) + Wiktionary/kaikki glosses & IPA
  - Web app: Vietnamese-first UI (EN toggle), FTS + pinyin + CJK-substring search, browse by level, word detail, licenses screen. Verified end-to-end in headless Chrome.
- Versions/roadmap: [docs/PLAN.md](docs/PLAN.md) · Source/license verdicts: [docs/RESEARCH-SOURCES.md](docs/RESEARCH-SOURCES.md)
- Deviation from plan: NGSL skipped in 0.1 (download URL 404s; CEFR-J + freq cover the need).
- Pack `2026.07.29-2` is published on [GitHub Releases (v0.1)](https://github.com/nhhandevops/multilingual-studies/releases/tag/v0.1) under CC BY-SA 4.0 — see "The database" below.
- 2026-07-30: git history was rewritten (force-push) to purge 142 MB of accidentally committed pack duplicates; `.gitignore` now blanket-ignores `*.gz`. If an old clone exists somewhere, delete and re-clone instead of pulling.

## Next up: v0.4

v0.3 is complete and tagged. See [docs/PLAN.md](docs/PLAN.md) for the 0.4 row and pick it up from
there; the roadmap is the "what's next" oracle, this file is the "where were we" one.

Known follow-ups from v0.3, none blocking:

- **Tone drills are not SRS-backed.** `/tones` scores in memory only. Making a tone card a real
  card is now cheap: syllable graphemes carry `audio_id`, `playAudio()` exists, and
  `CardSnapshot.kind` is an optional enum that can take a third value (keep it optional — v0.2
  cards must still validate).
- **Uppercase letterforms are geometric**, not handwriting models: A–Z are straight-line
  skeletons. Fine for tracing, but a cursive/print teaching model would be better.
- **The pack is 47.5 MB gz.** Levers if that becomes a problem: restrict stroke data to HSK +
  top-N frequency (~−9 MB), drop to `18k-abr` audio (~−2.5 MB), or split media into an optional
  second pack. Nothing needs this yet.
- **`/write` browses hanzi by HSK level or stroke count only** — no search box on that page.
- The **storage-lock takeover protocol** is still owed (see below); it is the oldest real debt.

## Fresh-machine setup

Requirements: Node ≥ 20, pnpm ≥ 9, git. (Python 3.12 not needed until 0.4+.)

```sh
git clone https://github.com/nhhandevops/multilingual-studies && cd multilingual-studies
pnpm install                  # build approvals for better-sqlite3/esbuild are committed in pnpm-workspace.yaml
pnpm ingest seed:all          # downloads ~110 MB of sources into apps/ingest/data-cache/ (gitignored), builds build/staging.db
pnpm pack:build && pnpm pack:verify
pnpm ingest pack publish      # copies pack into apps/web/public/packs/
pnpm dev                      # http://localhost:5173
```

Notes:

- `seed:all` is idempotent and resumable; re-runs skip unchanged inputs (hash check).
  If a downloaded file's hash differs from `sources.lock.json`, you get a warning, not a failure — upstream moved; that's expected for CC-CEDICT (updated daily).
- The pack in `apps/web/public/packs/` is **gitignored** — every machine builds its own from sources (same stable IDs ⇒ same user progress compatibility).
- `gh` CLI is optional: plain `git push` works with stored credentials; repo creation was done via API.

## The database (content pack) — what it is and how to use it

> **Tiếng Việt:** `content.db` là từ điển SQLite (147k từ EN/ZH/FR) được build tự động từ các
> nguồn miễn phí. KHÔNG sửa file .db bằng tay — muốn thêm dữ liệu thì viết/chạy module trong
> `apps/ingest` rồi build lại pack. File này không nằm trong git; máy khác lấy nó bằng cách
> tự build (cách A) hoặc tải từ GitHub Releases (cách B).

> **Size changed in v0.3:** the pack is now **47.4 MB gz** (was 27.7 MB) — stroke data for 9,432
> characters plus 7.5 MB of pinyin syllable audio. The published v0.1 release asset is still the
> old 27.7 MB pack: it works, but has no `graphemes`/`hanzi_info`/`audio`, so `/write` and
> `/pinyin` will be empty. Rebuild from sources (way A) to get the writing and audio features.

**What it is.** `content.db` is a read-only SQLite database holding all study content
(tables: `words`, `senses`, `graphemes`, `hanzi_info`, `audio`, `audio_blobs`, `sources`, `meta`,
FTS index `words_fts`;
later: sentences, grammar…). It is **generated, never edited**: `apps/ingest` downloads vetted sources into
`data-cache/`, normalizes them into `build/staging.db`, and `pack build` produces
`build/packs/<version>/content.db` (+ `content.db.gz` + `manifest.json` with sha256).
`pack publish` copies it to `apps/web/public/packs/content.pack`; the web app downloads that once,
verifies the hash, and installs it into the browser's private OPFS storage. At runtime the app
never reads from the repo folder. User progress will live in a **separate** `user.db` (from v0.2)
— per-device, never in git, never inside the pack.

**Getting the DB on another machine — two ways:**

- **A. Rebuild from sources (canonical):** `pnpm ingest seed:all && pnpm pack:build && pnpm pack:verify && pnpm ingest pack publish`. ~110 MB of downloads, a few minutes. Deterministic IDs ⇒ the result is compatible with any machine's user progress.
- **B. Download the ready-made pack:** grab `content.db.gz` + `manifest.json` from the [v0.1 release](https://github.com/nhhandevops/multilingual-studies/releases/tag/v0.1), rename `content.db.gz` → `content.pack`, put both files in `apps/web/public/packs/`. Done — `pnpm dev` serves it. (Keep the `.pack` name — see invariant 3.)

**Adding/updating data — the only correct path:**

1. Vet the source's license in [docs/RESEARCH-SOURCES.md](docs/RESEARCH-SOURCES.md) first (NC/ND/GPL = do not bundle).
2. Write or extend an ingest module in `apps/ingest/src/sources/<lang>/` — it must call `registerSource()` and derive IDs via `@mls/shared` `ids.ts`. Register the command in `apps/ingest/src/cli.ts` SEEDS map.
3. Run it (`pnpm ingest seed:<name>`), then `pnpm pack:build && pnpm pack:verify` (verify enforces attribution, license modes, and ID stability) and `pnpm ingest pack publish`.
4. Commit the code + `sources.lock.json` change; publish the new pack to GitHub Releases when a version ships.

Hand-editing a `.db` file is always wrong: it gets overwritten by the next build, bypasses license
checks, and its changes exist on one machine only. The ingest modules ARE the database's source of truth.

**Inspecting the data:** open `build/packs/<version>/content.db` (or `build/staging.db`) with any
SQLite tool — [DB Browser for SQLite](https://sqlitebrowser.org/), `sqlite3` CLI, or DBeaver.
Try: `SELECT headword, reading, level FROM words WHERE lang='zh' AND level='HSK1' LIMIT 20;`

**About stray `content.db*.gz` files:** on 2026-07-29 the dev-server pack URL was downloaded
several times in a browser, leaving 7 identical `content.db*.gz` copies in the repo root; 6 were
accidentally committed and later purged from git history (force-push, 2026-07-30). `.gitignore`
now blanket-ignores `*.gz`. If you see such files: they are redundant browser downloads — delete them.

## Invariants — do not break

1. **Stable content IDs** ([packages/shared/src/ids.ts](packages/shared/src/ids.ts)) — the contract that keeps future SRS state alive across pack upgrades. Never change derivation without a rename/migration plan; `pack verify` fails on >0.5% word-ID churn between consecutive packs.
2. **License discipline** — never add a data source not vetted in [docs/RESEARCH-SOURCES.md](docs/RESEARCH-SOURCES.md). Known traps: Chinese Grammar Wiki (CC BY-NC-SA → link-only), Oxford 3000 (© OUP), RFI (scraping ban), Verbiste/FreeDict (GPL data vs App Store), Tatoeba CK audio (NC-ND). Every ingest registers a `sources` row; `license_mode` ('bundled'/'verbatim-only'/'link-only') is enforced by `pack verify`.
3. **Pack file extension** — the published pack is `content.pack` (gzip inside). Do not rename to `*.gz`: servers (incl. Vite dev) special-case `.gz` with `Content-Encoding` and corrupt the stream. The worker sniffs gzip magic bytes either way.
4. **Schema changes** — edit [packages/content-pack/src/schema.sql](packages/content-pack/src/schema.sql), bump `SCHEMA_VERSION` in build.ts if breaking, delete `build/staging.db` and re-run `seed:all` (cached downloads make this fast). FTS tables are contentless (`content=''`) — clear with `INSERT INTO x(x) VALUES('delete-all')`, never `DELETE`.
5. **Git flow** — commit + push at the end of every session; each finished version gets an annotated tag (`git tag -a v0.x`) pushed with `--follow-tags`. Update this HANDOFF before the final push.
6. **user.db is sacred and separate** (from v0.2) — the learner's SRS state lives in OPFS at
   `/user.db`, never inside the content pack, never in git. Rules: the pack-update path may only
   ever touch `/content.db`; never call `poolUtil.wipeFiles()`/`removeVfs()` as a recovery tactic
   (it destroys progress); `user.db` migrations in
   [packages/shared/src/srs/schema.ts](packages/shared/src/srs/schema.ts) are **append-only** —
   add a batch, never edit a shipped one, and let `USER_SCHEMA_VERSION` derive from the array
   length. Cards key on raw word IDs (never URL-encoded) and must render from their `snapshot`
   JSON, never by joining `content.db` — words may legitimately vanish between packs.

## Repo map

| Path | What |
|---|---|
| `docs/PLAN.md` | Master plan: architecture + versioned roadmap 0.1→2.0 (the "what's next" oracle) |
| `docs/RESEARCH-SOURCES.md` | Verified free-source & license ledger (2026-07-29 deep research) |
| `apps/ingest` | CLI: `pnpm ingest seed:…` / `pack build` / `pack verify` / `pack publish` |
| `apps/web` | React 19 + Vite PWA; sqlite-wasm worker in `src/db/sqlite.worker.ts` (owns content.db **and** user.db); `src/db/user-queries.ts` = all SRS SQL; `src/routes/review.tsx`; `src/srs/clock.ts` = debug clock |
| `apps/web/src/components/stroke-writer.tsx` | (v0.3) hanzi-writer wrapper — data comes from the pack, never the network; works for any glyph with `{strokes,medians}` |
| `apps/web/src/routes/write.tsx`, `glyph.tsx` | (v0.3) `/write` browse-by-level/strokes, `/write/:glyph` animate · trace · decomposition · add writing card |
| `apps/web/public/licenses/ARPHICPL.TXT` | (v0.3) **must stay committed** — the Arphic PL requires redistributing its text; `pack verify` fails if it goes missing |
| `packages/shared` | ID derivation (contract!), Zod types, `src/srs/` = user.db schema + ts-fsrs wrapper (`@mls/shared/srs`) |
| `packages/content-pack` | schema.sql (contract!), pack builder/verifier |
| `sources.lock.json` | sha256 + license of every raw download (auto-maintained) |
| `.claude/skills/` | (from v0.6) `/daily-pull` and `/curate-pack` Claude Code skills |

## Testing recipe (browser verification)

No test framework yet (deliberate — 0.1/0.2). End-to-end checks are ad-hoc Playwright scripts driving
installed Chrome: `npm i playwright-core` in a scratch dir, launch with
`executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'` (adjust per machine),
navigate to the dev server, wait for `input.searchbox` (pack install can take ~1 min first run),
assert search results. See PLAN's per-version "Verify" bullets for what to check each release.

Gotchas learned the hard way (they cost real debugging time):

- **Don't assert on `ul.words li` alone after typing a query** — the previous query's rows linger
  through the 150 ms debounce in [home.tsx](apps/web/src/routes/home.tsx), so you read stale rows.
  Wait for the expected headword (`waitForFunction`) instead.
- Same class of trap on `/review`: the done screen flips phase before its stats refresh lands, so
  poll for the final numbers rather than reading once.
- The backup file input is `display:none` — Playwright needs `{ state: 'attached' }`, and
  `setInputFiles` works fine on it (no need to click the visible button).
- A fresh `browser.newContext()` gets an empty OPFS, so every run re-downloads and re-installs the
  pack (~2 s from localhost) and starts with an empty `user.db` — that is what makes SRS runs
  repeatable.
- **Stop `pnpm dev` before `pnpm ingest pack publish`.** On Windows, overwriting
  `apps/web/public/packs/content.pack` while Vite watches it kills the dev server with `EBUSY`.
- To fast-forward the scheduler:
  `page.evaluate(ms => localStorage.setItem('mls_debug_clock_offset_ms', String(ms)), 4*864e5)`
  then reload. v0.2's acceptance run saw the "Good" interval grow 2 d → 16 d this way, and v0.3's
  grapheme card reproduced exactly the same 2 d → 16 d.
- **Navigate in-app (`page.click` on a nav `<a>`), not with `page.goto`, once the app is loaded.**
  A fresh document load can lose the exclusive OPFS handles to a page Chrome froze in the
  back/forward cache; you then get the (now friendly) "reload to continue" screen mid-test. This
  cost real debugging time — see the storage-lock note above. `scratchpad/e2e/probe-locked.mjs`
  reproduces it deliberately.
- **To test the stroke quiz for real, replay the character's own medians as pointer events.**
  Read `graphemes.stroke_json` straight from the built pack, then invert hanzi-writer's Positioner:
  bounds are `(0,-124)..(1024,900)`, so with `width=height=260, padding=12`,
  `scale = 236/1024`, `xOffset = 12`, `yOffset = 124*scale + 12`, and
  `local = (cx*scale + xOffset, 260 - yOffset - cy*scale)`; add the SVG's `getBoundingClientRect()`
  origin. That is what proves the packed stroke data is *usable*, not merely present.
- `/review`'s done screen keeps `phase='done'` when you click the nav link to `/review` (same
  route ⇒ no remount). Click the done screen's own back button instead.
