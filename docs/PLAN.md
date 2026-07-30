# Multilingual Studies — Master Plan (v0.1 → 2.0)

## Context

The user (Vietnamese IoT engineer, Windows 11) wants a personal language-study app: beginner → fluent in **English, Mandarin Chinese, French** (Japanese later). Their earlier attempt ([devenglish](d:/Hobbies/devenglish)) died at "Sprint 0" — schemas and scaffolding, zero content. **Anti-failure rule for this project: every version ends with real content you can study that day.** Infrastructure is only built in the same version as the content that needs it.

### Confirmed requirements (user Q&A)
- Languages v1: EN + ZH + FR; architecture language-pluggable (JA = 2.0 proof).
- Website (local-first PWA) now; **packageable for iOS/Android app stores later** (user explicit). Dev machine is Windows → iOS via CI (GitHub Actions macOS runners, free on public repos).
- Data: free sources only, zero recurring cost, local SQLite. Ingestion triggered by a **`/daily-pull` Claude Code slash command** (user-triggered; Claude fetches + curates words/sentences/grammar/tips into the DB).
- Bilingual **Vietnamese/English UI toggle** (i18n from day 1).
- Alphabet module per language: pronunciation + **step-by-step writing** (stroke animation + tracing quiz).
- Daily memory tips referencing free books/videos; **IoT/professional vocab module**; SRS for retention; versioned roadmap 0.1, 0.2 … 1.0, 1.1 …

### Research performed (all sources verified alive + licenses read, 2026-07-29)
A 10-agent research workflow verified every data source and the platform path. Full digest preserved at:
`C:\Users\nguye\AppData\Local\Temp\claude\d--Hobbies-multilingual-studies\3cc4deba-8b95-4645-8f55-7e6d4954708c\tasks\research_digest.txt`
**→ Step 1 of implementation: copy this digest into the repo as `docs/RESEARCH-SOURCES.md`** (it is the license ledger's source of truth and the temp dir is volatile).

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Stack | React 19 + Vite + TS PWA; pnpm workspaces (no Turborepo); **no backend server in 0.x** | Static hosting + local DB is the whole stack; reuses devenglish patterns |
| App-store path | Capacitor 8 later (NOT Expo) | Reuses 100% of DOM UI; Expo = full rewrite, weak for dictionary typography |
| Storage | Two SQLite DBs: `content.db` (read-only versioned pack, built on PC) + `user.db` (SRS state, exportable) | Pleco pattern; pack swaps never lose progress |
| Web DB driver | `@sqlite.org/sqlite-wasm` + **opfs-sahpool** VFS in a Worker | Public domain; needs NO COOP/COEP → works on GitHub/Cloudflare Pages; single-tab OK |
| Native DB driver (1.1+) | `@capacitor-community/sqlite` v8 `copyFromAssets` | MIT, maintained |
| SRS | `ts-fsrs` v5 (MIT, FSRS-6) | Anki's default algo; ~20-30% fewer reviews than SM-2 |
| Daily load | 5–10 new words/language/day; steady-state reviews ≈ 8–12× new intake (~30–45 min/day total) | Build a load simulator into onboarding (0.8) |
| Ingestion trigger | `.claude/skills/daily-pull/SKILL.md` driving `apps/ingest` CLI | User stays in control; zero cost when not run |
| Legal | In-app Licenses screen (schema-enforced attribution); publish compiled pack under CC BY-SA on GitHub Releases; ship ARPHICPL.TXT | Satisfies ShareAlike; defuses App-Store-DRM argument |
| iOS from Windows | PWA interim → GitHub Actions macOS runner + fastlane → TestFlight (1.2). Apple $99/yr deferred until store submission; Play $25 one-time | Only unavoidable cost, paid late |
| Git & GitHub | `git init` on day 1; **public** GitHub repo `multilingual-studies` (account nhhandevops) via `gh repo create` — public = free unlimited macOS CI minutes + free pack hosting on Releases (private fallback: Codemagic 500 min/mo). **Commit + push at the end of every work session and every `/daily-pull` run**; each version = annotated tag `v0.1`, `v0.2`… pushed to origin | Work is never only-local; versions are recoverable checkpoints |

## Verified data sources (bundle-safe unless noted)

**English**: kaikki.org Wiktextract EN JSONL (defs/POS/IPA/examples/audio URLs; CC BY-SA) core dict · Open English WordNet (CC BY) relations · NGSL 2,800 words (CC BY-SA; use **.com** site — .org mirror compromised) · CEFR grading = CEFR-J Profile A1-B2 + Octanove C1/C2 (github openlanguageprofiles/olp-en-cefrj) · freq = wordfreq + hermitdave/FrequencyWords (CC BY-SA, covers en/fr/zh_cn) · Tatoeba 2.04M sentences (CC BY 2.0 FR, store per-sentence username attribution) · Wikibooks grammar (CC BY-SA) sequenced by CEFR-J Grammar Profile. **NEVER bundle**: Oxford 3000/5000 (© OUP), google-10000-english (LDC), raw SUBTLEX-US, Kelly/EFLLex (NC).

**Chinese**: CC-CEDICT 124.7k (CC BY-SA, MDBG export) · HSK 2.0+3.0 = drkameleon/complete-hsk-vocabulary (MIT) + ivankra/hsk30 (MIT; official 3,000-char list + **official graded grammar CSV**) · strokes = hanzi-writer (MIT) + hanzi-writer-data ~9.5k chars (Arphic PL — bundleable, ship ARPHICPL.TXT) · decomposition = makemeahanzi dictionary.txt (LGPL, keep as separate table) + Unihan · pinyin-pro (MIT) conversion/tone drills · pinyin+word audio = hugolpz/audio-cmn (CC BY-SA; 1,707 syllables + 8,596 HSK words) · freq = SUBTLEX-CH via **PLOS supplementary files** (CC BY) · Tatoeba cmn 88.5k (auto-pinyin at build) · sentence audio = **AISHELL-1/-3** (Apache 2.0, OpenSLR SLR33/93) — Tatoeba cmn audio is 0% usable; AISHELL-2 academic-only · grammar prose = Wikibooks zh + **deep links only** to Chinese Grammar Wiki (CC BY-NC-SA — never bundle) · Sino-Vietnamese cognate hints (đại học/大学) = CEDICT × Wiktionary SV readings — unique differentiator.

**French**: kaikki frwiktionary (2.03M words, IPA, conjugation "forms") + kaikki EN-wikt FR extract (389k, EN glosses) · Lexique 3.83 (CC BY-SA verified; use http URL or github chrplr/openlexicon — www TLS broken) freq+phonology backbone · conjugations from kaikki forms (AVOID Verbiste/FreeDict — GPL data vs App Store) · **CEFR: no redistributable list exists** → derive A1-C2 from Lexique percentiles at Milton & Alexiou (2009) anchors (~1k/2k/3k/3.75k/4.5k/5k+ lemmas), FLELex LREC-2014 methodology as citation, validate privately vs FLELex HF mirror (don't ship) · Tatoeba fra 729k · word audio = **Lingua Libre via Commons: 430,990 FR recordings**, deterministic `LL-Q150 (fra)-Speaker-word.wav` names (~15k files/hr documented route) · sentence audio = MLS French 1,077h (CC BY) + SIWIS 10h studio (CC BY) + Tatoeba fra CC subset ~2.1k · grammar = **Tex's French Grammar (CC BY — bundle verbatim, has audio)** + Wikibooks fr · reading = Gutenberg FR (PD, Gutendex API).

**Cross-language**: ipa-dict (MIT; word→IPA for en_US/UK, fr_FR, zh Hans/Hant) · cmudict (BSD-ish) minimal pairs · Commons IPA chart audio (CC BY-SA per file) · drammock/phonetics-teaching-assets 51 CC0 sagittal SVGs (θ/ð, ʁ, ɻ; adapt for ʂ/ʐ) · **Latin strokes: no open dataset exists** → extract single-line glyph paths from Relief SingleLine font (SIL OFL, French-made, accents covered), hand-order ~62 glyphs once into hanzi-writer JSON format → one tracing engine for hanzi + Latin · EN sentence audio = Common Voice CC0 via ungated fsicoli HF mirror (official downloads now account-gated) + LibriVox (PD) + MLS.

**IoT module**: NIST CSRC glossary 10,114 defs (PD, daily bulk JSON) · Wikipedia EE/CS glossaries (CC BY-SA, clean dt/dd markup) · Wikibooks Embedded Systems · translations via **Wikidata labels/aliases (CC0, keyless SPARQL — en/zh/fr/vi in one query)**; keep aliases, spot-check ~5% vs industry jargon.

**Daily fresh content**: **VOA Chinese — US-gov public domain, verified publishing daily**, keyless RSS + MP3s (strip AFP/AP/Reuters items; plain-text credit) · Global Voices EN + FR (CC BY 3.0, daily, adaptation/simplification allowed) · The Conversation FR (CC BY-**ND** — cache verbatim only) · Wikipedia ITN blurbs en/fr/zh (CC BY-SA) · VOA Learning English/English/Afrique **frozen Mar 2025** but PD archives = bundleable graded seed corpora (mirror early; poll for revival) · **Link-only, never cache**: RFI français facile (TDM opt-out verified), UN News, RFA · Wikinews closed May 2026 (archive dumps usable).

**Learning science / tips**: keyword method (Atkinson & Raugh 1975, free ERIC PDF) · tone-colour convention (T1 red/T2 yellow/T3 green/T4 blue) · French gender-by-ending 80% rule (Lyster 2006) as data · PD bundleable books: W.W. Atkinson *Memory* (Gutenberg #41478), Ebbinghaus 1885 (Wikisource) · link lists verified active 2026: EN = BBC LE, Luke's, **Elight (Vietnamese-language)**; ZH = Mandarin Corner, Grace Mandarin, TeaTime, Hacking Chinese; FR = RFI, TV5Monde, InnerFrench, Lawless French, Easy French · anchors: Cambridge GLH (A2 ≈ 180-200h … C2 ≈ 1000-1200h), FSI (FR 600-750h; ZH 2,200h upper bound — Vietnamese speakers benefit from tones + 50-70% Sino-Viet lexicon), HSK 3.0 cumulative 300 → 10,896.

## Architecture

### Monorepo (v0.1 tree)
```
multilingual-studies\
├── package.json  pnpm-workspace.yaml  tsconfig.base.json  README.md
├── sources.lock.json            # every raw download: url, sha256, license, retrieved_at
├── LICENSES\{ARPHICPL.TXT, SOURCES.md}
├── docs\RESEARCH-SOURCES.md     # copied research digest (step 1!)
├── .claude\skills\{daily-pull, curate-pack}\SKILL.md
├── apps\
│   ├── web\                     # React+Vite PWA; src/db/sqlite.worker.ts (wasm+sahpool);
│   │   └── src\{i18n\{vi,en}.json, routes\{home,browse,word,licenses}.tsx}
│   └── ingest\                  # Node CLI: better-sqlite3, commander, zod, undici, p-queue
│       ├── src\{cli.ts, lib\{download,staging,upsert,ids,politeness}.ts, sources\{en,zh,fr,shared}\*.ts}
│       ├── scripts-py\          # Python one-offs: xlsx parsing (SUBTLEX-CH), AISHELL/ffmpeg, py-fsrs optimizer (1.4)
│       └── data-cache\          # gitignored raw dumps
├── packages\
│   ├── shared\src\{types.ts, ids.ts, srs\fsrs.ts, db\{driver,web,node,queries}.ts}
│   └── content-pack\src\{schema.sql, build.ts, verify.ts, manifest.ts, load.ts}
└── build\                       # gitignored: staging.db → content.db → packs\<version>\
```

### Stable content IDs (the contract)
Deterministic TEXT PKs, never autoincrement: `{lang}:{type}:{source}:{sourceKey}` — e.g. `zh:w:cedict:你好`, `zh:snt:tatoeba:1234567`, `zh:g:hw:好`, `fr:g:latin:é`, `tech:t:nist:access_control`, `zh:d:voa:2026-07-29:slug`. Derivation lives ONLY in `packages/shared/src/ids.ts`. SRS cards key on word-level IDs; cards carry a `snapshot` JSON so orphaned cards survive pack removals; `pack verify` diffs ID sets between pack versions and fails if >0.5% vanish.

### content.db schema (essentials)
`meta` · `languages(code, names, script, level_scheme)` · `sources(id, license, attribution_text, license_mode: 'bundled'|'verbatim-only'|'link-only')` — **license_mode enforced by pack verify** · `words(id, lang, headword, alt_form, reading, freq_rank, level, sv_cognate, source_id, extra JSON)` · `senses(word_id, ord, pos, gloss_en, gloss_vi, examples)` · `word_forms` (FR conjugations) · `word_relations` · `sentences(id, lang, text, trans_en, trans_vi, reading, audio_id, level_est, attribution)` · `word_sentences` · `graphemes(id, lang, glyph, kind, reading, ipa, stroke_json, diagram_ref, audio_id)` — one format for hanzi + Latin + pinyin syllables + IPA phones · `grammar_topics(…, body_md NULL when link-only, external_links)` · `tech_terms` + `tech_term_labels(term_id, lang, label, aliases)` · `daily_items` · `daily_plan(date, lang, word_id, reason)` · `tips` · `audio(id, kind, location 'bundled:…'|'remote:…', speaker, license, attribution NOT NULL)` · FTS5: `words_fts`, `sentences_fts`.

Audio strategy: bundle small pedagogical audio (pinyin syllables, IPA phones); word/sentence audio = remote URLs + opt-in cache; Web Speech API fallback with "synthetic" badge.

### user.db
`cards(id = content ID, fsrs fields, snapshot JSON, suspended)` · `review_log` (append-only, py-fsrs-optimizer-shaped) · `settings(ui_lang, enabled_langs, new_per_day, installed_pack_version)` · `daily_stats(date, lang, counts, seconds)`. One-button export/import (the only irreplaceable data).

### Pack format
`packs/<version>/`: `content.db.gz` + `assets.tar.gz` + `manifest.json {packVersion '2026.07.29-1', schemaVersion, minAppVersion, sha256s, counts}`. App update: download → verify sha256 + integrity_check → atomic pointer flip in settings. Same logic feeds Capacitor copyFromAssets later.

### Ingestion (apps/ingest)
One CLI subcommand per source (`seed:*` one-time, `daily:*` idempotent-per-date, `pack build|verify|publish`). Principles: upsert-by-content-ID into staging.db; `--skip-unchanged` via input sha256; resumable downloads (Range + sha256 sidecars); per-host p-queue rate limits + honest UA; **no row without source_id**; kaikki JSONL streamed line-by-line with lemma filter (never loaded whole). Key seeds by version: 0.1 dictionaries/levels/freq + `seed:fr-cefr-derive`; 0.3 strokes/IPA/pinyin-audio; 0.4 tatoeba + audio crawls (checkpointed, overnight); 0.5 grammar; 0.6 daily modules + VOA LE archive mirror; 0.7 NIST/Wikidata; 0.8 SV cognates.

### /daily-pull skill (SKILL.md contract)
1. Run `daily:voa-zh`, `daily:globalvoices` (en+fr), `daily:wiki-itn` → staging.
2. Per language: `daily:candidates --json` → Claude curates 1–3 news items at user's level (prefer zh items with audio; enforce license_mode — never inline RFI/UN/RFA bodies) + 5–10 new words tied to today's items with best example sentences + Vietnamese `curated_note`.
3. Write today's tip (rotate technique: keyword method, tone colors, gender endings, SV cognates) → `tips:add --json`.
4. `daily:select --json` → `pack build --bump` → `pack verify`.
5. **Commit + push**: `git add` changed tracked files (`sources.lock.json`, `LICENSES/SOURCES.md`, any authored content/skill edits) → commit `daily-pull: YYYY-MM-DD` → `git push`. (Built packs `*.db.gz` stay gitignored — they're distributed via GitHub Releases, not git history.)
6. Report: items/language, words + one-line reasons, tip, pack version, failures. Rules: idempotent per date; degrade gracefully; never add unregistered sources; target <10 min.

`/curate-pack` (weekly): license audit, dedupe, 10 random gloss spot-checks/language, prune daily_items >90 days, source liveness pings, check VOA revival, pack-size trend.

## Roadmap (each version = git tag + something usable that day)

| Ver | Name | Ships | "You can now…" |
|---|---|---|---|
| **0.1** | Three real dictionaries (~3 wknd) | Scaffold + pack format + seeds (cedict/hsk/ngsl/cefrj/kaikki-EN-filtered/lexique/fr-kaikki/freq/fr-cefr-derive) + FTS search + word detail + vi/en toggle + Licenses screen | Search 你好/"record"/"bonjour" offline; browse HSK1/A1 lists |
| **0.2** | Daily review loop (~2 wknd) | user.db + ts-fsrs + add-to-deck + review screen + budgets + streaks + backup export | Study 5 new words/language daily; clear reviews |
| **0.3** | Writing systems (~3 wknd) | hanzi-writer engine for hanzi AND Latin (hand-authored from Relief SingleLine) + pinyin chart w/ audio + tone drills + IPA chart + sagittal diagrams + tracing quiz → grapheme cards | Watch 好 draw itself and trace it; trace é; hear every pinyin syllable |
| **0.4** | Sentences + sound (~3 wknd) | Tatoeba (filtered to pack words) + word_sentences + zh auto-pinyin + Lingua Libre FR crawl (top 5k) + zh word audio + curated sentence audio + TTS fallback | Every card has a real example; most words speak with a human voice |
| **0.5** | Grammar (~2 wknd) | Wikibooks EN (CEFR-J-sequenced) + HSK official grammar CSV + CGW deep links + Tex's French Grammar verbatim w/ audio + reader UI | Read HSK-2 的/得/地 offline; Tex's grammar with audio |
| **0.6** | The daily pull (~2 wknd) | Daily source modules + VOA LE archive seed + real SKILL.md + Today screen (news at level, word-of-day → SRS queue, tip) + evergreen tips | Run `/daily-pull` with coffee; open app to fresh curated content |
| **0.7** | IoT vocabulary (~1-2 wknd) | NIST + Wikipedia glossaries + Wikidata en/zh/fr/**vi** labels + tech module UI + tech cards | Learn firmware/固件/micrologiciel with Vietnamese label; drill in SRS |
| **0.8** | Stats + forecast (~2 wknd) | Dashboard (known words vs HSK/CEFR tables) + **load simulator** (new/day → review load + GLH/FSI anchors w/ Vietnamese adjustment) + SV cognate hints on zh cards | "At 7 zh words/day you hit HSK-3 vocab ~Mar 2027, ~35 min/day" |
| **0.9** | Real PWA (~2 wknd) | Service worker + full offline + storage.persist() + pack update UI + backup nag + deploy (Cloudflare/GitHub Pages) + iOS Add-to-Home tested | Install on phone; study on the bus offline |
| **1.0** | Daily driver (gate, no features) | Acceptance: 30 days real use (≥25 daily-pulls); ≥1,500 words/language w/ level+example, ≥60% human audio; daily loop ≤45 min; verify green (zero attribution gaps); pack on GitHub Releases CC BY-SA; backup proven | — |
| **1.1** | Android (Capacitor 8, ~3 wknd) | apps/mobile shell + native sqlite driver + copyFromAssets + Play internal track ($25) | Real APK on your phone |
| **1.2** | iOS via CI (~3 wknd) | GH Actions macOS + fastlane → TestFlight (Apple $99 paid NOW, not before; Scaleway M4 €0.22/hr if interactive Xcode needed) | Study on iPhone from TestFlight |
| **1.3** | Listening drills | AISHELL-1/3 curated zh dictation; MLS FR; Common Voice EN (mirror fsicoli early) | Graded dictation practice |
| **1.4** | FSRS personalization | review_log → py-fsrs optimizer → personal parameters | Scheduler tuned to your memory |
| **1.5** | Optional sync | Only if two-device pain is real: smallest Fastify or CF Worker+D1, append-only log merge | Cross-device progress |
| **2.0** | Japanese = pluggability proof | 'ja' row + JMdict (CC BY-SA) + KanjiVG/animCJK strokes + kana charts + Tatoeba jpn + JLPT scheme + **zero schema changes** (acceptance test) | Fourth language, same engine |

## Risks & mitigations
1. **devenglish failure mode** — 0.1's done = "I searched a word in 3 languages", not "build passes"; no version >3 weekends (cut scope, not the shippable); plain UI until 0.9.
2. **kaikki dump size** — stream gunzip line-by-line + lemma filter; ~30 GB disk note in README; FR glosses from the smaller EN-wikt extract.
3. **iOS Safari eviction** — Add-to-Home early, storage.persist(), weekly backup nag; only user.db is precious; native app (1.2) is the durable fix.
4. **Mirror rot** (Lexique http, fsicoli, VOA archives, audio repos) — **mirror-early policy**: download all seed sources in month 1, sha256 in sources.lock.json, external-disk archive; /curate-pack pings weekly.
5. **CC compliance drift** — schema-enforced (NOT NULL source_id/attribution, license_mode); pack verify fails build on violations.
6. **Latin stroke authoring is manual** (~62 glyphs, no open dataset) — one-off extractor + throwaway click-to-reorder review page; lowercase+accents first; do-once asset committed to repo.
7. **Bulk audio throttling** — checkpointed crawler, concurrency ≤2, overnight, top-5k first; TTS fallback means missing audio never blocks.
8. **3 languages × solo hours** — per-language enable toggles; content parity NOT required per version; budgets + load simulator prevent review-debt spirals.

## Verification (per version, and overall)
- Every version's table row has a "You can now…" — demo it manually in the browser.
- 0.1: `pnpm ingest seed:all && pnpm ingest pack verify` green; counts ≈ zh ~120k / en ~8k backbone / fr ~10k; 10 spot-checks show correct pinyin/IPA/level; pack ≤ ~30 MB gz.
- 0.2: FSRS intervals advance under a debug clock offset; user.db export/import round-trips.
- 0.3: all HSK-1 chars have stroke data (build check); ARPHICPL.TXT on Licenses screen.
- 0.4: zero audio rows with NULL attribution; zero Tatoeba CK NC-ND clips.
- 0.6: `/daily-pull` twice same day → no dupes; network kill mid-run → graceful partial report.
- 0.9: Lighthouse installable; full airplane-mode session; pack N-1→N preserves all cards.
- 1.0: the acceptance gate above, proven by daily_stats.

## First implementation session (when approved)
1. `git init` → copy research digest into `docs/RESEARCH-SOURCES.md` → scaffold monorepo → **initial commit** → `gh repo create nhhandevops/multilingual-studies --public --source . --push` (confirm public vs private with user at that moment; public recommended for free macOS CI + Releases hosting).
2. `packages/content-pack/src/schema.sql` + `packages/shared/src/ids.ts` (the two contracts) → commit + push.
3. First ingest: `seed:zh-cedict` (smallest, cleanest source) → pack build → render one word in the browser. Then the rest of 0.1.
4. Standing rule for ALL sessions: commit + push at the end of every working session; finish each version with an annotated tag (`git tag -a v0.1`) pushed to origin.
