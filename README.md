# multilingual-studies

Local-first app for studying **English, Mandarin Chinese, and French** (Japanese planned) —
built for a Vietnamese learner, from beginner to fluent. Web PWA now, iOS/Android via Capacitor later.

**Live app:** <https://nhhandevops.github.io/multilingual-studies/> — installable, works fully
offline after the first visit. Content packs are distributed as GitHub Release assets
(compilation licensed CC BY-SA 4.0; per-source credits on the in-app Licenses screen).

**Every version ships something you can study that day.** No infrastructure without content.

## How it works

```
free data sources ──> apps/ingest (Node CLI) ──> build/staging.db ──> content pack
                        ▲                                                (content.db.gz + manifest)
                        │ orchestrated by /daily-pull                        │
                        │ (Claude Code skill)                                ▼
                                                     apps/web (React PWA, sqlite-wasm + OPFS)
                                                       └── user.db (FSRS review state, exportable)
```

- `content.db` — read-only, versioned pack built on the PC from verified free sources (CC-CEDICT,
  Wiktionary/kaikki, Lexique, HSK lists, Tatoeba, Lingua Libre …). See `docs/RESEARCH-SOURCES.md`
  for every source, its license, and why it was chosen (or rejected).
- `user.db` — your review history and FSRS scheduling state. The only irreplaceable data; one-button export.
- Stable content IDs (`zh:w:cedict:你好`) mean pack upgrades never lose study progress.

## Workspace

| Path | What |
|---|---|
| `apps/web` | React 19 + Vite PWA (vi/en UI) |
| `apps/ingest` | Ingestion CLI: `seed:*` (one-time), `daily:*` (idempotent per date), `pack *` |
| `packages/shared` | Zod types, stable-ID derivation, FSRS wrapper, DB driver interface |
| `packages/content-pack` | Pack schema, builder, verifier, loader |
| `.claude/skills` | `/daily-pull` and `/curate-pack` Claude Code skills |
| `docs/RESEARCH-SOURCES.md` | Verified source & license ledger (do not add sources not vetted here) |
| `sources.lock.json` | sha256 + retrieval date of every raw download |

## Requirements

- Node ≥ 20, pnpm ≥ 9, Python 3.12 (a few one-off data scripts)
- ~30 GB free disk for raw dictionary dumps (`apps/ingest/data-cache/`, gitignored)

## Getting started

```sh
pnpm install
pnpm ingest seed:zh-cedict   # first content
pnpm pack:build && pnpm pack:verify
pnpm dev                     # open the app
```

## Licensing

App code: MIT. Compiled content packs: **CC BY-SA 4.0** (published on GitHub Releases) —
they aggregate CC-licensed data; full attribution in `LICENSES/SOURCES.md` and the in-app Licenses screen.
