---
name: curate-pack
description: Weekly maintenance pass over the content pack — licence audit, gloss spot-checks, pruning stale daily items, source liveness pings, and the pack-size trend. Use when the user asks to curate, audit or spring-clean the pack, or says "/curate-pack".
---

# /curate-pack

The weekly counterweight to `/daily-pull`. The daily pull adds; this checks what accumulated.

Nothing here is automatic. Every step ends in a *finding* you report, and you only change data when
the finding says something is wrong.

## 1. Licence audit

```sh
pnpm pack:verify
```

Green is the baseline, not the goal. Then look at what verify cannot see, because that is where
this project's real licence bugs have all been:

- **v0.4:** every French clip was stamped `CC BY-SA 4.0` while 68% were CC0. The string was
  well-formed and untrue. No checker could catch it.
- **v0.5:** a vetted Wikibooks title turned out to be an 1851 grammar written for native speakers.
- **v0.6:** VOA's public-domain grant covers material produced *exclusively* by VOA, so an
  adapted Associated Press story inside a public-domain source is still AP's.

So each week, pick **one source** and verify its licence *at the artifact* rather than in the
ledger — fetch two or three real items and check what they actually say. Rotate through sources
across weeks. Record what you checked and what you found in `docs/RESEARCH-SOURCES.md` if the
ledger turns out to be wrong; a correction there is the deliverable.

```sh
sqlite3 build/staging.db "SELECT id, license, license_mode, retrieved_at FROM sources ORDER BY retrieved_at;"
```

## 2. Ten gloss spot-checks per language

```sh
sqlite3 build/staging.db "SELECT w.lang, w.headword, w.reading, s.gloss_en FROM words w
  JOIN senses s ON s.word_id = w.id WHERE w.level IS NOT NULL
  ORDER BY random() LIMIT 30;"
```

Read them. You are looking for the failure modes this project has actually shipped: a wrong
polyphone reading, a gloss that belongs to a different sense, a traditional-script headword in a
simplified-only field. Report the hit rate honestly — "30 checked, 2 wrong" is the useful sentence.

## 3. Prune daily items older than 90 days

```sh
sqlite3 build/staging.db "SELECT date, COUNT(*) FROM daily_items
  WHERE source_id IN ('voa-chinese','global-voices','wikipedia-itn')
  GROUP BY date ORDER BY date;"
```

News ages out; the graded archive does not. Only ever prune the three daily sources — the
`voa-learning-english` rows are a permanent corpus dated by their own publication date.

```sh
sqlite3 build/staging.db "DELETE FROM daily_items
  WHERE source_id IN ('voa-chinese','global-voices','wikipedia-itn')
    AND date < date('now','-90 days');
  DELETE FROM daily_plan WHERE date < date('now','-90 days');"
```

Cards already added to the deck are unaffected: they live in the browser's `user.db` and render
from their own snapshot, never by joining `content.db` (invariant 6).

## 4. Source liveness

Ping each daily source and report whether it is still publishing:

- VOA Chinese feed — `https://www.voachinese.com/api/zm_yql-vomx-tpeybti` — check the newest
  `<pubDate>` is within a couple of days. This is the pinned token; if it 404s, the feed was
  regenerated and `daily:voa-zh` needs a new one from `/rssfeeds` (which serves a *different page
  on different requests* — fetch it twice and take the Chinese-titled one).
- Global Voices — `https://globalvoices.org/feed/` and `https://fr.globalvoices.org/feed/`.
- Wikipedia — `Modèle:Accueil actualité` (fr) and `Template:Itn` (zh) via `action=parse`.

**Check whether VOA English has revived.** `https://learningenglish.voanews.com/api/…` and
`voanews.com/api/epiqq` have been frozen at mid-March 2025 since the 2025 USAGM cuts, with FY2026
funding restored and litigation ongoing. If items newer than that appear, English gains a
public-domain daily source and `daily:globalvoices` stops being the only one. That is a
version-scoping fact, so put it in HANDOFF.

## 5. Pack-size trend

```sh
ls -la build/packs/*/content.db.gz
```

Report the series and the delta. The standing decision, unresolved since v0.4: the pack is ~130 MB
and the levers are French word-audio `LEVELS`, zh word audio at `18k-abr`, restricting stroke data,
or splitting media into a second optional pack — which v0.9 forces anyway. Say which way the trend
is going; do not act on it without the user.

## 6. Report

One short section per step, each ending in a finding rather than a checkmark. If everything was
clean, say what you checked and that it was clean — an audit that only speaks when it fails is
indistinguishable from an audit that did not run.
