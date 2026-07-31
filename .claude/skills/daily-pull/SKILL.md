---
name: daily-pull
description: Pull today's news for Chinese, English and French, curate 1-3 items per language plus the day's new words and a study tip, then rebuild and publish the content pack. Use when the user asks to run the daily pull, refresh today's content, or says "/daily-pull".
---

# /daily-pull

Fetch today's material, choose what is worth studying, and leave the app with a fresh Today screen.

Target: **under 10 minutes**, most of it yours rather than the network's.

## Before you start

- Run from the repo root (`d:\Non-work\multilingual-studies` on this machine).
- **Stop `pnpm dev` before `pack publish`.** On Windows, overwriting `content.pack` while Vite
  watches it kills the dev server with `EBUSY`.
- Everything below is idempotent per date. Running twice on one day **replaces**, never doubles:
  item ids are date-scoped and each module clears its own (source, lang, date) window first.
- Use `--date YYYY-MM-DD` on every command if you are re-running for a past day.

## 1. Pull

```sh
pnpm ingest daily:all
```

Three modules run: `daily:voa-zh` (VOA Chinese, public domain), `daily:globalvoices` (English and
French, CC BY 3.0), `daily:wiki-itn` (French and Chinese Wikipedia current events, CC BY-SA 4.0).

**A failing source is not a failed run.** `daily:all` catches each module separately and prints a
summary naming what succeeded and what did not. If one host is unreachable, continue with what you
have and say so in the final report — do not retry in a loop and do not abandon the pull.

It also writes a *provisional* word plan from the words today's articles actually contain, so the
Today screen works even if you stop here. Step 3 replaces it.

## 2. Curate

```sh
pnpm ingest daily:candidates > candidates.json
```

Read it. For **each language** choose:

- **1–3 news items.** Prefer items that teach: a clear story at a manageable level, not a
  three-clause headline about a procedural vote. `level_est` is a *measured* coverage figure, not
  a publisher's grading — treat it as a hint, and trust the excerpt over the number.
- **5–10 new words**, taken from `langs.<lang>.words` (they are drawn from the day's own reading,
  which is the point — the words and the articles should reinforce each other). Skip words the
  learner would obviously already know.
- **A one-line note in Vietnamese** per kept item: why it is worth reading, or what to watch for.
  This is the `curated_note`, and it is the one piece of the Today screen written by you.

Never invent an item, a URL, or an attribution. Only ids that appear in `candidates.json` may be
kept — the pull is the only thing allowed to create rows.

## 3. Write the day's tip

Rotate the technique rather than repeating a favourite. The evergreen set already covers:
keyword method, tone colours, Sino-Vietnamese cognates (and where they mislead), French gender
endings, liaison, nasal vowels, English final consonants, word stress, /θ/–/ð/, spacing, and
listen-before-you-read. Write something that is **not** one of those, in Vietnamese, and make it
actionable in one sitting.

```jsonc
// tip.json
{
  "lang": "all",            // or "zh" | "en" | "fr"
  "slug": "short-kebab-slug",
  "title": "Tiêu đề tiếng Việt",
  "body": "Markdown tiếng Việt. Dùng - cho danh sách, ** cho in đậm.",
  "technique": "keyword-method",
  "links": [{ "label": "Luyện thanh điệu", "url": "/tones" }]   // optional; /routes work
}
```

```sh
pnpm ingest tips:add --file tip.json
```

## 4. Apply the curation

```jsonc
// selection.json
{
  "date": "2026-07-31",
  "keep": ["zh:d:voa-chinese:2026-07-31:8181331", "..."],
  "notes": { "zh:d:voa-chinese:2026-07-31:8181331": "Tin ngắn, nhiều từ về kinh tế." },
  "words": {
    "zh": [{ "id": "zh:w:cedict:地震", "reason": "xuất hiện trong tin động đất hôm nay" }],
    "en": [{ "id": "en:w:cefrj:statelessness", "reason": "..." }]
  }
}
```

```sh
pnpm ingest daily:select --file selection.json
```

It prints what it kept, dropped, annotated and planned, plus `unknownWords` — any word id that is
not in the pack. **If `unknownWords` is non-empty, fix the ids and re-run**; a plan row pointing at
a missing word fails `pack verify`.

## 5. Build, verify, publish

```sh
pnpm pack:build
pnpm pack:verify        # must be green — do not publish a pack that fails
pnpm ingest pack publish
```

`pack verify` re-applies the wire-agency screen over the finished pack. If it reports
`daily_items … is wire-agency-derived`, an ingest module let an Associated Press or Reuters piece
through: **drop that item and rebuild** rather than relaxing the check. VOA's public-domain grant
covers material produced *exclusively* by VOA; adapted wire copy is not ours to redistribute.

## 6. Commit and push

```sh
git add sources.lock.json docs/ .claude/ apps/ packages/
git commit -m "daily-pull: YYYY-MM-DD"
git push
```

Built packs are gitignored — they ship via GitHub Releases, not git history.

## 7. Report

Say plainly:

- items kept per language, with their titles
- the new words and a one-line reason each
- the tip you wrote
- the new pack version and its size
- **anything that failed**, including sources that were unreachable and items dropped by the wire
  screen. A pull that quietly reports only its successes is worse than one that failed loudly.

## Rules

- **Never add a source that is not vetted in `docs/RESEARCH-SOURCES.md`.** Known traps: RFI and
  France Médias Monde (terms forbid storage; deep-link only), UN News (personal use only), Radio
  Free Asia (a USAGM *grantee* — copyrighted, unlike VOA), The Conversation (CC BY-ND: verbatim
  only, and they ask for a tracking pixel this app cannot serve), Tatoeba CK audio (NC-ND).
- **Attribution is per item, never per corpus.** Global Voices' CC BY names the *author*, and on
  the French feed `dc:creator` is the translator — the module already reads the right name from
  the article's credit block. Do not "simplify" an attribution string.
- **Degrade, do not stall.** Partial content today beats perfect content tomorrow.
