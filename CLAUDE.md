# multilingual-studies — Claude Code instructions

**Start every session by reading [HANDOFF.md](HANDOFF.md)** — it holds the current state, the
next version's scope, and the invariants (stable IDs, license rules, pack format). The versioned
roadmap and architecture live in [docs/PLAN.md](docs/PLAN.md); data-source/license verdicts in
[docs/RESEARCH-SOURCES.md](docs/RESEARCH-SOURCES.md) — never add a source not vetted there.

Rules that override defaults:

- Every version must ship something the user can study that day; no infrastructure without content (see PLAN's anti-"Sprint 0" rule).
- Never break ID derivation in `packages/shared/src/ids.ts` (SRS progress depends on it).
- Data may only enter the DB through `apps/ingest` modules that register a `sources` row; `pnpm pack:verify` must pass before publishing a pack.
- Commit + push at the end of every working session; tag finished versions (`git tag -a v0.x`, push with `--follow-tags`); update HANDOFF.md's "Current state"/"Next up" before the final push.
- UI is Vietnamese-first with an EN toggle; user-facing strings go through i18next (`apps/web/src/i18n/`).

Commands: `pnpm dev` (web), `pnpm ingest seed:all`, `pnpm pack:build`, `pnpm pack:verify`,
`pnpm ingest pack publish`, `pnpm -r typecheck`.
