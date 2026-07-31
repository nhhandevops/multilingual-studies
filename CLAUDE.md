# multilingual-studies — Claude Code instructions

**Start every session by reading [HANDOFF.md](HANDOFF.md)** — it holds the current state, the
next version's scope, and the invariants (stable IDs, license rules, pack format). The versioned
roadmap and architecture live in [docs/PLAN.md](docs/PLAN.md); data-source/license verdicts in
[docs/RESEARCH-SOURCES.md](docs/RESEARCH-SOURCES.md) — never add a source not vetted there.

Rules that override defaults:

- Every version must ship something the user can study that day; no infrastructure without content (see PLAN's anti-"Sprint 0" rule).
- Never break ID derivation in `packages/shared/src/ids.ts` (SRS progress depends on it).
- Data may only enter the DB through `apps/ingest` modules that register a `sources` row; `pnpm pack:verify` must pass before publishing a pack.
- **Verify a source's license per file when the source lets you.** A vetted entry in RESEARCH-SOURCES states what a corpus *usually* is, not what every file in it is — Lingua Libre is documented as CC BY-SA 4.0 and is actually 67% CC0. `pack verify` cannot catch a license string that is well-formed but untrue.
- Every version's claims must be backed by a script in [tools/e2e/](tools/e2e/) that a fresh clone can run; add one per phase and keep it free of machine-specific paths.
- Commit + push at the end of every working session; tag finished versions (`git tag -a v0.x`, push with `--follow-tags`); update HANDOFF.md's "Current state"/"Next up" before the final push.
- UI is Vietnamese-first with an EN toggle; user-facing strings go through i18next (`apps/web/src/i18n/`).

Commands: `pnpm dev` (web), `pnpm ingest seed:all`, `pnpm pack:build`, `pnpm pack:verify`,
`pnpm ingest pack publish`, `pnpm -r typecheck`.
Daily (v0.6, driven by the `/daily-pull` skill): `pnpm ingest daily:all`, `daily:candidates`,
`daily:select --file f.json`, `tips:add --file t.json`.
Acceptance: `cd tools/e2e && npm install`, then `node verify-v06.mjs` with `pnpm dev` running.
`verify-upgrade-v02-to-v03.mjs` is the exception — it swaps the pack file, so it needs
`static-server.mjs` and `MLS_BASE=http://localhost:5199`, never `pnpm dev`.

Two operational traps worth knowing before they cost an hour: stop `pnpm dev` before
`pnpm ingest pack publish` (Windows kills the watcher with `EBUSY`), and bump a seed's
`PARSER_VERSION` when you fix its parser, or the corrected run is skipped as "unchanged".
A first `seed:all` takes ~2.5 h — `seed:fr-word-audio` alone is ~2 h of throttled Commons
downloads, checkpointed and resumable.
