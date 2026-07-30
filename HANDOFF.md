# HANDOFF — continue the work from any machine

> **TL;DR (tiếng Việt):** Dự án đang ở **v0.1** (đã xong, đã tag). Kế hoạch tổng thể nằm ở
> [docs/PLAN.md](docs/PLAN.md). Việc tiếp theo là **v0.2 — vòng lặp ôn tập SRS hằng ngày**.
> Trên máy mới: `pnpm install` → `pnpm ingest seed:all` → `pnpm pack:build` → `pnpm ingest pack publish` → `pnpm dev`.

Keep this file current: update the **Current state** and **Next up** sections at the end of every
working session, and commit it with the session's push. It is the single source of truth for
"where were we?" on a fresh clone.

## Current state (updated 2026-07-29)

- **v0.1 shipped & tagged** — "Three real dictionaries in the browser":
  147,261 words / 171,479 senses / 9 sources, pack `2026.07.29-2` at 27.7 MB gz.
  - ZH: full CC-CEDICT + HSK 2.0/3.0 levels (11,430 words) + OpenSubtitles freq ranks
  - EN: 8,648-word CEFR backbone (CEFR-J + Octanove) + WordNet glosses + ipa-dict IPA + freq
  - FR: 15,000 Lexique lemmas + **derived** CEFR bands (see PLAN — no redistributable FR list exists) + Wiktionary/kaikki glosses & IPA
  - Web app: Vietnamese-first UI (EN toggle), FTS + pinyin + CJK-substring search, browse by level, word detail, licenses screen. Verified end-to-end in headless Chrome.
- Versions/roadmap: [docs/PLAN.md](docs/PLAN.md) · Source/license verdicts: [docs/RESEARCH-SOURCES.md](docs/RESEARCH-SOURCES.md)
- Deviation from plan: NGSL skipped in 0.1 (download URL 404s; CEFR-J + freq cover the need).

## Next up: v0.2 — "Daily review loop" (~2 weekends)

Per [docs/PLAN.md](docs/PLAN.md): `user.db` on opfs-sahpool (separate from the content pack) +
`ts-fsrs` wrapper in `packages/shared/src/srs/` + add-to-deck from word pages/level lists +
review screen (Again/Hard/Good/Easy) + per-language new-card budget (default 5/day) +
`daily_stats`/streak + user.db export/import button. Verify: FSRS intervals advance under a debug
clock offset; export/import round-trips. Cards key on **word IDs** and carry a `snapshot` JSON.

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

## Invariants — do not break

1. **Stable content IDs** ([packages/shared/src/ids.ts](packages/shared/src/ids.ts)) — the contract that keeps future SRS state alive across pack upgrades. Never change derivation without a rename/migration plan; `pack verify` fails on >0.5% word-ID churn between consecutive packs.
2. **License discipline** — never add a data source not vetted in [docs/RESEARCH-SOURCES.md](docs/RESEARCH-SOURCES.md). Known traps: Chinese Grammar Wiki (CC BY-NC-SA → link-only), Oxford 3000 (© OUP), RFI (scraping ban), Verbiste/FreeDict (GPL data vs App Store), Tatoeba CK audio (NC-ND). Every ingest registers a `sources` row; `license_mode` ('bundled'/'verbatim-only'/'link-only') is enforced by `pack verify`.
3. **Pack file extension** — the published pack is `content.pack` (gzip inside). Do not rename to `*.gz`: servers (incl. Vite dev) special-case `.gz` with `Content-Encoding` and corrupt the stream. The worker sniffs gzip magic bytes either way.
4. **Schema changes** — edit [packages/content-pack/src/schema.sql](packages/content-pack/src/schema.sql), bump `SCHEMA_VERSION` in build.ts if breaking, delete `build/staging.db` and re-run `seed:all` (cached downloads make this fast). FTS tables are contentless (`content=''`) — clear with `INSERT INTO x(x) VALUES('delete-all')`, never `DELETE`.
5. **Git flow** — commit + push at the end of every session; each finished version gets an annotated tag (`git tag -a v0.x`) pushed with `--follow-tags`. Update this HANDOFF before the final push.

## Repo map

| Path | What |
|---|---|
| `docs/PLAN.md` | Master plan: architecture + versioned roadmap 0.1→2.0 (the "what's next" oracle) |
| `docs/RESEARCH-SOURCES.md` | Verified free-source & license ledger (2026-07-29 deep research) |
| `apps/ingest` | CLI: `pnpm ingest <seed:*|pack build|pack verify|pack publish>` |
| `apps/web` | React 19 + Vite PWA; sqlite-wasm worker in `src/db/sqlite.worker.ts` |
| `packages/shared` | ID derivation (contract!), Zod types |
| `packages/content-pack` | schema.sql (contract!), pack builder/verifier |
| `sources.lock.json` | sha256 + license of every raw download (auto-maintained) |
| `.claude/skills/` | (from v0.6) `/daily-pull` and `/curate-pack` Claude Code skills |

## Testing recipe (browser verification)

No test framework yet (deliberate — 0.1). End-to-end checks are ad-hoc Playwright scripts driving
installed Chrome: `npm i playwright-core` in a scratch dir, launch with
`executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'` (adjust per machine),
navigate to the dev server, wait for `input.searchbox` (pack install can take ~1 min first run),
assert search results. See PLAN's per-version "Verify" bullets for what to check each release.
