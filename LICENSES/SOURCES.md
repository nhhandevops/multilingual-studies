# Data source attributions

Human-readable ledger of every data source bundled in (or linked from) the content pack.
Mirrors the `sources` table in `content.db`; the in-app Licenses screen renders that table.
Full research + license verification: [docs/RESEARCH-SOURCES.md](../docs/RESEARCH-SOURCES.md).

| Source | License | Mode | Attribution |
|---|---|---|---|
| CC-CEDICT (MDBG) | CC BY-SA 4.0 | bundled | CC-CEDICT, https://www.mdbg.net/chinese/dictionary?page=cc-cedict |

_Rows are appended as each `seed:*` ingest lands. `Mode` ∈ bundled / verbatim-only / link-only (enforced by `pack verify`)._

## License texts shipped with the pack

- `ARPHICPL.TXT` — Arphic Public License, covers hanzi-writer-data / Make Me a Hanzi stroke data (added in v0.3).

## The compiled pack

The compiled `content.db` pack is published under **CC BY-SA 4.0** on GitHub Releases,
satisfying ShareAlike for the CC BY-SA sources it aggregates.
