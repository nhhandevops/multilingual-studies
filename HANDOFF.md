# HANDOFF — continue the work from any machine

> **TL;DR (tiếng Việt):** Dự án đang ở **v0.8** (đã xong — **thống kê & dự báo**).
> Mục `/stats`: vốn từ của bạn so với **thang HSK/CEFR** (thanh tiến độ theo từng cấp), và **mô
> phỏng tải ôn tập** chạy bằng chính FSRS-6 — kéo thanh trượt "7 từ mới/ngày" là thấy ngay:
> ~68 lượt ôn/ngày ≈ 15 phút, phủ hết từ vựng HSK1–3 khoảng **tháng 6 2027**. Kèm mốc giờ
> Cambridge/FSI với ghi chú cho người Việt (2.200 giờ tiếng Trung là TRẦN — thanh điệu đã có sẵn,
> ~60% từ vựng Việt gốc Hán). Và chính các cặp gốc Hán đó giờ nằm trên thẻ: **8.342 từ tiếng
> Trung** hiện **từ Hán Việt có kiểm chứng** (大学 → đại học, 注意 → chú ý) — chỉ những cặp
> từ điển Wiktionary xác nhận là từ Việt thật, không ghép âm bừa (手机 KHÔNG có, vì "thủ cơ"
> không phải tiếng Việt).
>
> Trước đó, v0.7 — **từ vựng nghề IoT**:
> Mục `/tech`: **161 thuật ngữ** IoT/nhúng/mạng/bảo mật, mỗi khái niệm hiện tên ở **bốn thứ
> tiếng** — firmware / 固件 / firmware (micrologiciel) / Phần sụn — kèm định nghĩa tiếng Anh
> (Wikipedia hoặc NIST) và nút ＋ đưa thẳng vào bộ thẻ ôn tập (bộ thẻ "Nghề" riêng, không ăn vào
> hạn mức từ mới của ba thứ tiếng). Tên tiếng Trung **luôn là giản thể** (có cổng kiểm tra trong
> `pack verify`); ô nào trống là Wikidata thật sự chưa có tên — hiện là khoảng trống, không bịa.
> Phủ tiếng Việt: **134/161 (83%)**, trong đó 83 tên thuần Việt, còn lại là từ mượn (MQTT, GPIO…).
>
> Trước đó, v0.6 — **bản tin mỗi ngày**:
> Mục `/today`: tin tức thật, mới trong ngày, ở cả ba thứ tiếng — **VOA tiếng Trung** (miền công
> cộng), **Global Voices** tiếng Anh và tiếng Pháp (CC BY), và mục "tin vắn" của Wikipedia Pháp/Trung.
> Kèm theo: **160 bài đọc tiếng Anh phân cấp** từ kho VOA Learning English, **từ của ngày** lấy từ
> chính bài đọc hôm đó (bấm ＋ là vào bộ thẻ ôn tập), và **mẹo học mỗi ngày** (16 mẹo viết riêng cho
> người Việt). Chạy `/daily-pull` mỗi sáng để làm mới; không chạy thì màn hình vẫn dùng được.
> ⚠️ Một phần ba kho VOA Learning English **không phải miền công cộng** (bài lấy lại từ AP/AFP) —
> đã lọc bỏ tự động, xem bên dưới.
>
> Trước đó, v0.5 — **ngữ pháp**:
> Mục `/grammar`: **573 điểm ngữ pháp HSK chính thức** (chia cấp HSK1→7-9, đọc offline được),
> **toàn bộ 130 trang** Tex's French Grammar (có vài bài kèm giọng đọc thật), và 17 chương
> ngữ pháp tiếng Anh từ Wikibooks. Chỗ nào bị giấy phép cấm đóng gói (Chinese Grammar Wiki,
> CC BY-NC-SA) thì **chỉ để liên kết ra ngoài** — và chỉ liên kết khi trang đó có thật.
>
> Trước đó, v0.4 — **câu ví dụ + âm thanh**:
> Mỗi thẻ có câu ví dụ thật (68.683 câu Tatoeba, có pinyin và bản dịch tiếng Anh) ·
> 7.211 từ HSK và 2.782 từ Pháp A1–B1 có giọng người thật · từ nào không có bản thu thì
> đọc bằng giọng máy (TTS), kể cả câu ví dụ — nên **không từ nào là câm**.
> v0.3 trước đó: xem 好 tự viết rồi tự tô · tô chữ `é` · nghe đủ 1.707 âm tiết pinyin ·
> luyện thanh điệu · bảng IPA có hình cắt dọc.
> ⚠️ Gói dữ liệu giờ **130,4 MB** (tải một lần). Muốn nhỏ lại: sửa hằng số `LEVELS` trong
> [fr/word-audio.ts](apps/ingest/src/sources/fr/word-audio.ts) — xem "Pack size" bên dưới.
> Trên máy mới: `pnpm install` → `pnpm ingest seed:all` → `pnpm pack:build` → `pnpm ingest pack publish` → `pnpm dev`.

Keep this file current: update the **Current state** and **Next up** sections at the end of every
working session, and commit it with the session's push. It is the single source of truth for
"where were we?" on a fresh clone.

## Current state (updated 2026-08-01)

- **v0.8 shipped — "Stats + forecast".** A `/stats` screen (dashboard · simulator · anchors) and
  **8,342 attested Sino-Vietnamese cognates** on the zh vocabulary — the `sv_cognate` column that
  had been NULL since v0.1. The roadmap clause renders for real: *at 7 zh words/day you cover
  HSK1–3 vocabulary ~Jun 2027, ~15 min/day* (68 reviews/day, measured by simulation, not quoted
  from a rule). Pack `2026.07.31-11`: +0.2 MB, 30 sources.
  - **The cognates are ATTESTED, not composed — the version's defining decision.** A cognate is
    stored only when the Vietnamese word's own Wiktionary entry records "Sino-Vietnamese word
    from X" (the `vi-etym-sino` template in the kaikki.org Vietnamese extract, CC BY-SA). Both
    facts matter: the Vietnamese word EXISTS, and its descent from that exact Chinese word is on
    record. The tempting alternative — composing per-character Hán-Việt readings — was measured
    and rejected: 手机 composes to "thủ cơ" and 老师 to "lão sư", but Vietnamese says điện thoại
    and giáo viên. A reading that composes is not a word that exists. Result: 大学→đại học,
    注意→chú ý, 银行→ngân hàng… and 手机 correctly gets NOTHING.
  - **Unihan's kVietnamese was disqualified by measurement** before the design settled: 68%
    coverage of our 3,034 levelled characters with 電 (điện!), 学, 愛 simply absent, and Nôm
    readings mixed in unmarked. The ledger's [RECOMMENDED] for Unihan stands — for radicals and
    strokes; its Vietnamese field does not survive contact with the data. Ledger updated.
  - **Two traps in the chosen source, both measured** ([zh/sv-cognates.ts](apps/ingest/src/sources/zh/sv-cognates.ts)):
    the `vi-etym-sino` template's numbered args may be COMPONENTS (ngân hàng is {1:銀,2:行}), so
    the source word is the concatenation of all Han-carrying args — reading arg 1 alone both
    missed ngân hàng/chính phủ/công ti AND mis-attached điện thoại *viên* to 电话. And the match
    must be on the template, never the etymology text: the corpus contains "NON-Sino-Vietnamese
    reading of…" sentences that a text regex happily matches. Coverage: HSK1 196/508 · HSK2
    321/753 · HSK3 524/964 (the SV stratum is the abstract/formal vocabulary, so coverage RISES
    into the literary levels — consistent with the linguistics, not a bug).
  - The cognate rides `CardSnapshot.svCognate` (optional, additive — every earlier card still
    validates) and renders on the zh word page and the review answer, from the snapshot
    (invariant 6). For a Vietnamese learner it is the answer's strongest memory hook, so it
    renders above the glosses.
  - **The simulator RUNS FSRS-6, it does not quote the 10× rule** ([simulate.ts](packages/shared/src/srs/simulate.ts)):
    the same `rate()` wrapper, weights and 0.9 retention target that schedule real reviews,
    day by day over 365 simulated days, grades drawn from a seeded LCG so the same inputs give
    the same curve on every reload — a forecast that changes when you refresh is a mood. The
    simulation independently lands at **9.2–9.8× steady-state reviews per new card**, inside the
    research's 8–12× band: the rule of thumb is confirmed by the engine rather than assumed.
    ~350 ms per 365-day run, cached per slider value.
  - **Three kinds of number, labelled as what they are.** MEASURED: deck-vs-level-table bars
    (light = in deck, dark = reviewed at least once; denominators are the pack's own level
    counts) and the learner's seconds-per-card from their own history — used only past 50
    reviews, before that a default that SAYS it is a default. SIMULATED: the review load.
    ANCHORS: Cambridge GLH and FSI hours, quoted with the caveat that they assume an English
    speaker — for a Vietnamese learner the Mandarin 2,200 h is framed as a CEILING (tones are
    native equipment; ~60% of Vietnamese vocabulary is Sino-Vietnamese — the very pairs this
    version puts on the cards). The reach forecast is explicitly labelled VOCABULARY COVERAGE,
    not proficiency.
  - **The first e2e run failed its own test honestly**: the "set sliders to zh=7" assertion
    accepted any positive number, which the INITIAL 5/5/5 render already satisfies — it read 138
    (3×46) as if it were the zh=7 figure. The wait now requires the line to CHANGE from its
    captured initial state, in both the load check and the determinism check. A predicate the
    starting state already satisfies is a stub kinder than the real API.
  - Also fixed while building: the seed's first join ran a per-pair SELECT against the unindexed
    `alt_form` column — 147k-row scan × 13,866 pairs, killed at the ten-minute timeout — and was
    rewritten as one full-table read into maps (seconds).
  - Verified against pack `2026.07.31-11`: 大学 shows đại học on the word page, freezes it into
    a new card, and the review answer renders it from the snapshot; dashboard denominators equal
    the pack's level table and the just-added card is counted; the simulator is deterministic
    across reloads, its 7/day figure is 68 reviews ≈ 15 min/day, and the HSK-reach year matches
    the arithmetic; anchors carry the Vietnamese-adjustment framing. **0 off-origin requests,
    0 console errors. All 16 acceptance scripts pass.** Script: `tools/e2e/verify-v08.mjs`.

- **v0.7 shipped — "IoT vocabulary".** A `/tech` module over **161 curated concepts** in six
  domains (hardware 24 · electronics 28 · firmware 29 · networking 35 · security 20 · cloud 25),
  each showing its name in **four languages** with an English definition, per-term provenance, and
  a ＋ into its own SRS deck. The roadmap clause holds: *learn firmware/固件/micrologiciel with a
  Vietnamese label; drill in SRS*. Pack `2026.07.31-10`: 130.4 → **130.4 MB gz** (+0.05 MB — text
  is cheap), 29 sources.
  - **The term list is CURATED, not crawled** ([tech/terms.ts](apps/ingest/src/sources/tech/terms.ts)).
    NIST is 9,541 records of which 55% are acronym stubs and most of the rest is compliance
    vocabulary; Wikipedia's glossaries are organised by academic field. 161 hand-picked concepts an
    IoT engineer actually meets beat both — thin and correct, the v0.5 English-grammar call again.
    **The slug is ours and is the ID key** (`tech:t:iot:firmware`): Wikipedia renamed I²C → I2C
    live during recon, and an ID derived from the title would have forked and orphaned SRS state.
  - **Labels come from Wikidata (CC0), and the obvious implementation ships wrong data three
    ways** — all measured, all guarded now:
    (1) **the `zh` label is often traditional** (韌體, 編譯器 — whatever script the last editor
    typed). The seed requests `zh-hans` with `languagefallback=1`, which really converts and
    reports `source-language`. (2) **zh-hans itself is not a guarantee**: telemetry's zh-hans
    label is the mixed-script "遥測", typed into the simplified field by an editor. Labels AND
    aliases both pass the same screen — the lexicon-derived traditional-only character set from
    v0.4 — and a failing label is replaced by its first clean alias (遥测) or shipped as a gap
    (HSM). `pack verify` re-checks every zh label/alias against the same construction, so this
    cannot regress silently. (3) **`languagefallback` substitutes English silently**: a missing
    vi label arrives as `{value:"edge computing", language:"en", "for-language":"vi"}` under the
    `vi` key. The accept rule stores a label only when `language` is the requested one (or `mul`,
    Wikidata's explicit "identical everywhere" — Wi-Fi). Well-formed and untrue, v0.4's licence
    bug in a new field.
  - **Vietnamese coverage, with its counting rule beside it**: 134/161 terms (83%) carry a genuine
    vi-language label; 83 of those (52% of all terms) are Vietnamese prose (vi điều khiển, cảm
    biến, điện toán đám mây), the rest loanwords the vi community records verbatim (MQTT, GPIO,
    Raspberry Pi). **A gap ships as a gap** — the UI shows "chưa có tên trong tiếng này", never an
    English placeholder, because the gap is the true state of the data.
  - **The roadmap's own showcase was half wrong and ships honestly**: Wikidata's fr LABEL for
    firmware is "firmware" — *micrologiciel* is the fourth alias. Aliases ship too (they carry the
    everyday terms: 单片机 rides zh-hans, 传感器 rides aliases), so the quartet renders; the
    acceptance script asserts micrologiciel among label+aliases, not as the label.
  - **Definitions: glossary 60 · NIST 36 · article intro 65**, per-row provenance in a new
    `tech_terms.attribution` column (Wikipedia page + revid, or the NIST source publication —
    NIST asks for the citation; CC BY-SA wants the revision). Chain: Wikipedia's EEE/hardware/CS
    glossaries (median 92-char plain-English definitions) → NIST CSRC (authoritative, public
    domain, integrity-checked against its own `.meta` sha256 of the unzipped JSON) → the article's
    intro extract (guaranteed present). Two NIST traps fixed after the first run shipped them:
    a naive sentence-splitter broke on "(e.g.," and emitted a definition starting mid-phrase, and
    indexing a record's definition under all its abbrSyn expansions filed a definition of the
    Wireless Application Protocol under "wireless access point" — NIST's "WAP" record lists three
    UNRELATED expansions. Expansion keys are now used only when there is exactly one.
  - **Join hygiene** ([tech/vocab.ts](apps/ingest/src/sources/tech/vocab.ts)): batch 50,
    `redirects=1` always, correlate by title through `normalized[]`+`redirects[]` (the response is
    pageid-sorted, not request-ordered), and reject disambiguation pages by `ppprop` key presence —
    a bare "Node" resolves to a VALID QID whose labels translate "list of things called node".
    All 161 titles joined; risky ones are pre-qualified in the term list. The acceptance script
    re-checks a live sample of shipped QIDs for P31=Q4167410.
  - **Tech cards are the fifth deck.** `CardSnapshot.kind` gained `'tech'` and an optional
    `labels {zh,fr,vi}` field — both optional, so every card from v0.2–v0.6 still validates
    (the same additive pattern as v0.3's `kind` and v0.4's `example`). Cards store `lang='tech'`:
    a separate deck with its own daily budget, so drilling job vocabulary never eats the zh/en/fr
    allowance — and `review.tsx`'s LANGS list is exactly where v0.3's note said a new content lang
    must be added. The review answer renders vi/zh/fr labels from the snapshot (invariant 6); the
    prompt speaks with an English voice ('tech' matches no speech-synthesis voice).
  - `/tech` searches ACROSS languages — typing 固件 or 单片机 finds the English row, which is what
    an engineer who half-remembers a name actually does. Aliases are searchable for the same
    reason they are displayed.
  - **A latent v0.5-era bug in the whole suite surfaced**: every acceptance script picked the
    newest pack with a lexical `sort().at(-1)`, and the day's TENTH build ('2026.07.31-10') sorts
    before its ninth — verify-v07 validated a stale pack on its first run. All ten scripts now use
    a shared numeric-suffix `newestPack()` in [paths.mjs](tools/e2e/paths.mjs). The bug was
    harmless for fourteen versions because no day had ever reached ten builds; it fired the first
    day one did.
  - Verified against pack `2026.07.31-10`: 0 uncredited terms, 0 orphan labels, 0 traditional
    characters in zh labels/aliases, 8 sampled QIDs live-checked as non-disambiguation; 固件
    narrows the browse to exactly Firmware; the firmware card reaches the "Nghề (IoT)" deck and
    its review answer shows 固件 from the snapshot. **0 off-origin requests from the app, 0
    console errors. All 15 acceptance scripts pass.** Script: `tools/e2e/verify-v07.mjs`.

- **v0.6 shipped — "The daily pull".** A `/today` screen over **186 daily items** (26 pulled today
  + a 160-article graded archive), **16 evergreen tips**, and a per-day word plan that feeds the
  SRS deck. Both roadmap clauses hold: *run `/daily-pull` with coffee* · *open the app to fresh
  curated content*. Pack `2026.07.31-8`: 130.1 → **130.4 MB gz** (+0.32 MB), 26 sources.
  The skills are real now: [.claude/skills/daily-pull/SKILL.md](.claude/skills/daily-pull/SKILL.md)
  and [curate-pack](.claude/skills/curate-pack/SKILL.md).
  - **P1 — three daily sources, each with a licence trap that had to be measured.**
    `daily:voa-zh` ([zh/daily-voa.ts](apps/ingest/src/sources/zh/daily-voa.ts)) pulls VOA Chinese,
    the only verified public-domain DAILY Mandarin service. Its feed URL is **hardcoded on
    purpose**: `/rssfeeds` is not deterministic — two fetches two minutes apart returned two
    structurally different pages (46 VOA Learning English programme feeds one time, 27 Chinese
    section feeds the next), so resolving it at run time makes the pull depend on which page the
    CDN served.
  - `daily:globalvoices` ([shared/daily-globalvoices.ts](apps/ingest/src/sources/shared/daily-globalvoices.ts))
    pulls English and French. **`<dc:creator>` is the TRANSLATOR, not the author** — on the French
    feed for 10 items out of 10, and on the English feed for syndicated pieces. CC BY's one real
    condition is naming the author, so the obvious field credits the wrong person on most rows.
    This is v0.4's French-audio bug in a new costume: *a licence field filled from the nearest
    plausible place is not a licence field*. The real credit is parsed from each article's
    `gv-rss-footer` block, which distinguishes "Written (English) by" from "Traduit (Français) par".
    The **licence is verified per article** too, read only from `div.post-credit-container` — a
    page-wide regex would pick up a Wikimedia photo's CC BY-SA 3.0 or an RDF URL with a doubled
    slash, i.e. somebody else's licence.
  - `daily:wiki-itn` ([shared/daily-wiki-itn.ts](apps/ingest/src/sources/shared/daily-wiki-itn.ts))
    pulls the French and Chinese current-events blurbs. **The ledger's Chinese page name was
    wrong**: `Portal:新闻动态` redirects to a portal that transcludes the content, returns 508 KB
    with 778 list items, and reports its own revid as the attribution handle for text living
    elsewhere. `Template:Itn` is the content page. The French list **nests** — one entry holds a
    sub-list of two events and has no sentence of its own — so items are split at depth 0 and
    sub-items are emitted separately, inheriting the parent's date. Under `variant=zh-cn` the
    **hrefs stay traditional while the `title` attributes are converted**, so display text comes
    from the attribute or a simplified-only app shows 熊本縣.
  - **The licence is fetched, never remembered.** `meta=siteinfo&siprop=rightsinfo` returns each
    wiki's own statement — and the two wikis link their *localised* deeds (`deed.fr` vs `deed.zh`),
    which is one licence in two languages. Comparing the URLs verbatim made an agreement look like
    a conflict and failed the first run.
  - **P2 — the VOA Learning English archive, and the finding that shaped it.**
    `seed:voa-le` ([en/voa-le.ts](apps/ingest/src/sources/en/voa-le.ts)) crawled 900 pages of the
    frozen archive and kept **160 articles, 673 KB of text**. **314 of those 900 pages — 35% —
    were rejected as wire-agency-derived.** VOA's terms put material produced *exclusively* by VOA
    in the public domain, and a third of Learning English is AP or AFP reporting a VOA writer
    adapted: *"Mark Long reported this story for the Associated Press. Anna Matteo adapted it for
    VOA Learning English."* Two of those rejections were re-fetched by hand to confirm the screen
    is accurate rather than over-broad. **No `license_mode` check could ever catch this** — the
    source really is public domain, just not for those rows. The screen distinguishes two shapes
    that mean opposite things: a trailing "reported this story for X" byline disqualifies the
    piece; an inline "spoke to the Associated Press" is a quoted attribution and is kept. Measured
    on the shipped pack: **0 derived, 47 merely quoting.**
  - The rule lives in [packages/shared/src/wire.ts](packages/shared/src/wire.ts) and is applied
    **twice** — by the ingest module, and again by `pack verify` over the finished pack. The second
    pass is the one that matters: it catches a future module that forgets the first.
  - **The level is not in VOA's data**, and their own index contradicts itself. No article page
    carries a level (the only "Beginning/Intermediate/Advanced" strings are the site-wide nav), and
    the three level landing pages are an editorial index of *programmes* that files "Words & Their
    Stories" under Advanced while that programme's own blurb says it is written "at the
    intermediate and upper-beginner level". So no level is copied from VOA.
  - **Levels are MEASURED instead** ([lib/level.ts](apps/ingest/src/lib/level.ts)): the band at
    which 90% of the words we recognise sit at or below, against the pack's own HSK/CEFR lexicon.
    It is not a CEFR grading and the UI says so. It declines to answer below 20 recognised tokens —
    a threshold set by measurement, not taste: the reported band moves by 1/n per token, so at n=8
    one token is worth 12.5%, coarser than the 90% it is compared against, and *"le Slovène Tadej
    Pogačar remporte le Tour de France pour la cinquième fois"* came out **C2**. One-line news
    blurbs therefore get no level, which is the honest answer.
  - Result on the archive: **A1 3 · A2 75 · B1 75 · B2 7** — sensible for a controlled-vocabulary
    corpus, and the A2/B1 quotas are what stopped the crawl. **No audio is bundled**: one clip is
    3,450,715 bytes (the `_hq` sibling is exactly twice that), so the full set is ~113 GB. The MP3
    URL is stored and offered as an outbound link, never fetched.
  - **P3 — `/today`, built around the fact that the pack is older than today.** It is downloaded
    once and read offline, so "today's news" can only mean "the newest day this pack holds" — and
    the screen states which day that is rather than implying freshness it does not have. Every
    section degrades instead of vanishing: news falls back to the newest pulled day, graded reading
    is dateless, the word plan falls back to the newest plan, and the tip falls back to a
    deterministic pick from the evergreen set (deterministic, because "today's tip" that reshuffles
    on reload is a shuffle button).
  - **`daily:all` writes a provisional word plan** from the words today's own articles contain, so
    the screen works for someone who never runs the skill; `daily:select` replaces it with curation.
    It only writes where no plan exists, so re-running the pull cannot overwrite Claude's choices.
    A curated word shows its reason; an auto-picked one says so.
  - **P4 — the skills are real.** `/daily-pull` is a six-step operational document, not a stub:
    pull → curate → tip → select → build/verify/publish → commit → report, with the traps inline
    (stop `pnpm dev` before publishing; a non-empty `unknownWords` must be fixed, not ignored; a
    wire-screen failure means drop the item, never relax the check). `/curate-pack` is the weekly
    counterweight: rotate one source per week and verify its licence **at the artifact**, prune
    daily items past 90 days (never the archive), ping each source, and watch for VOA English
    reviving.
  - **`pack verify` gained the v0.6 gates**: every daily item must carry a per-item credit, no item
    may have neither body nor link, no planned word may be missing from the pack, tips must have a
    registered source and a body, and **no bundled body may be wire-derived**. The ID-churn gate
    now also covers `tips`; `daily_items` is deliberately excluded, because a pull replacing the
    day's items is the feature.
  - **A pre-existing v0.4 bug surfaced and is fixed.** On a pack older than v0.4 the review screen
    threw `SQLITE_ERROR: no such table: word_audio` three times per card — a feature added later
    assumed a table older packs do not have. `getWordAudio` now tolerates exactly "no such
    table"/"no such column" and returns nothing; every other SQL error still propagates. Found by
    running the upgrade acceptance script, which the blanket suite loop had been running in the
    wrong environment (it needs the static server, not `pnpm dev`) — the README's runner is fixed.
  - Verified against pack `2026.07.31-8`: re-running a pull the same day leaves the row count and
    the ids identical; an injected source failure still stores 3 source/language pairs, names the
    failure and exits 0; `/today` states the day it is showing, opens an item with 21 blocks of
    text and its per-item credit, and the word of the day lands in the SRS deck ("1 thẻ trong bộ");
    the tip is stable across reloads. **0 off-origin requests, 0 console errors. All 14 acceptance
    scripts pass.** Script: `tools/e2e/verify-v06.mjs`.

- **v0.5 shipped — "Grammar".** A `/grammar` reader over **720 topics**: the official HSK 3.0
  syllabus (573 points, graded HSK1→7-9), Tex's French Grammar in full (130 pages), and 17
  Wikibooks English chapters. Both roadmap acceptance clauses hold: *read HSK-2 的/得/地 offline*
  · *Tex's grammar with audio*. Pack `2026.07.31-6`: 128.9 → **130.1 MB gz** (+1.2 MB), 21 sources.
  - **P1 — the Chinese syllabus.** `seed:zh-grammar`
    ([apps/ingest/src/sources/zh/grammar.ts](apps/ingest/src/sources/zh/grammar.ts)) ingests
    ivankra/hsk30's `hsk30-grammar.csv`. **573 points, not the 625 lines the file has** — 38
    records wrap across lines inside quoted fields, so a per-line split silently reads garbage.
    `parseCsv()` in [text.ts](apps/ingest/src/lib/text.ts) is a whole-document RFC-4180 parser;
    use it for any CSV not known to be one-line-per-record.
  - **Nothing is translated that we cannot translate honestly.** The source is entirely Chinese.
    Its `Group` column is a real closed taxonomy (12 values) — but `Category` has **135 values and
    most are grammar PATTERNS** (`还是……吧`, `X就X（点儿）吧`), not category names. So the point
    text stays Chinese (a Chinese grammar point's name *is* Chinese) and only the taxonomy is
    localised, in the UI through i18next where user-facing strings belong. `title_vi` is NULL
    rather than machine-translated.
  - **P2 — Tex's French Grammar, bundled verbatim.** `seed:fr-grammar`
    ([apps/ingest/src/sources/fr/grammar.ts](apps/ingest/src/sources/fr/grammar.ts)) takes all
    **130 grammar pages** in the site's own index order — that order is the pedagogy, so it
    becomes `ord`. Tex is not CEFR-graded, so `level` is NULL rather than invented.
    CC BY 3.0 is **verified on each page** (`creativecommons.org/licenses/by/`) before it is
    bundled, not assumed from the ledger. Pages are iso-8859-1 and use named entities, so both
    the bytes and `&eacute;` need decoding — `decodeHtml()` handles the Latin-1 set, including
    the semicolon-less legacy form (`ne&nbsp pas`) that appears in the conjugation pages.
  - **P3 — English, from the OTHER Wikibooks book.** The 0.5 row named "English in Use"; that is
    deliberately **not** what ships. Measured: its contents page says it is "intended for use by
    native speakers of English or advanced learners", its About page records that the initial text
    was copied from **Goold Brown's 1851 grammar**, and `thou`/`hath`/`OBS.`/Brown's citations
    still run through its Syntax, Punctuation, Commas and Articles chapters. Its modern companion
    "English Grammar" ships instead — 17 chapters, 46 KB, **0 archaic markers**. Thin and correct
    beats thick and misleading. This is v0.4's licensing lesson in a new dimension: **the ledger
    describes a source, it does not vouch for every page of it.**
  - **The Grammar Wiki links were nearly all dead, and measuring is what caught it.** The Chinese
    Grammar Wiki is CC BY-NC-SA — link only, never bundled — and the first implementation pointed
    each point at a search URL. Sampled over 16 real HSK1–2 points, **2 resolved and 14 landed on
    "There were no results"**. Linking the point's individual TOKENS instead resolved **15 of 16**:
    the wiki is organised by particle (的, 得, 地, 把, 虽然), not by syllabus wording. The seed now
    splits each point into tokens, checks every distinct token once against the live wiki (cached
    to disk), and **stores a link only where a real article exists** — a point with no match gets
    no link at all. A "learn more" that dead-ends is worse than admitting we have nothing.
    Full-run result: **239/576 tokens have a real article; 273/573 points carry ≥1 verified link**;
    the wiki itself is registered as a `link-only` source so its NC licence shows on `/licenses`.
    Two operational notes from the crawl: cache only DEFINITIVE answers (a throttle recorded as
    "no article" silently deletes a link that exists and looks exactly like a correct result), and
    pace GENTLY — at `polite()`'s standard 250 ms spacing this wiki rate-limits every request into
    the full 2s/4s/8s retry ladder (~15 s/token); at ~800 ms spacing the same checks answer
    instantly. Gentler was literally faster.
  - **The acceptance script had the same blind spot** and passed while shipping dead links,
    because it asserted an `<a>` was *present*, never that it *resolved*. It now fetches the 得
    link and fails on a "no article" body, and fails outright if any topic still stores a search
    URL. Checking existence is not checking correctness.
  - `/grammar` renders by **`license_mode`, not by language**: a link-only topic shows an explicit
    reason and its outbound link instead of a blank page, and the reader refuses to print body
    text for such a source even if a future seed wrongly stored some. Markdown is rendered by
    [markdown.tsx](apps/web/src/components/markdown.tsx), which emits React elements and never
    touches `dangerouslySetInnerHTML` — the same reasoning that made IPA diagrams `<img src="data:">`.
  - **Tex's audio is a lever, not a default — and never bundle the podcast copies.** The RSS
    enclosures point at `/tex/aud/itunes/…`, and every one of those files carries an ID3 `APIC`
    frame with the same ~82 KB cover JPEG (adj2_ex1: 136,798 B as the iTunes copy, 54,960 B plain
    at `/tex/aud/…` — identical audio). The seed strips `/itunes/` from the URL and refuses any
    clip that still contains `APIC`. Real totals: 730 clips ≈ 57 MB plain (the feed's "114 MB"
    double-counts cover art); all 11 chapters at one clip per page ≈ 22 MB. `AUDIO_CHAPTERS`
    defaults to `['adj']` — 8 clips, **1.0 MB** — which proves the feature end to end; everything
    else falls back to v0.4's TTS.
  - `pack verify`'s **ID-churn gate now covers `grammar_topics`** as well as `words`, so a slug-
    derivation change fails the build instead of surfacing as a bug report. (Chinese grammar IDs
    include the HSK level and the point text — fine for a reader, revisit before cards.)
  - Verified against pack `2026.07.31-6`: 得 opens at HSK2 and reads offline with a Grammar Wiki
    link **fetched and confirmed to resolve during the test** (checking a link exists is not
    checking it works); a French page renders 47 blocks and 78 emphasised spans with no literal
    `**` left; a Tex clip plays 6.40 s from a `blob:` URL; 0 link-only rows carry body text;
    0 orphan sources; 0 search URLs. **0 off-origin requests, 0 console errors.** All 11 earlier
    acceptance scripts still pass. Script: `tools/e2e/verify-v05-p1-p2.mjs`.

- **v0.4 shipped — "Sentences + sound".** Pack `2026.07.31-4`: 68,683 sentences, **11,700 audio
  clips** (1,707 pinyin syllables + 7,211 HSK words + 2,782 French words), 9,993 word→audio links,
  17 sources, **128.9 MB gz**. Both roadmap clauses are met: *every card has a real example* ·
  *most words speak with a human voice* — and anything without a recording now speaks with a
  synthetic one, so no word is silent.
  - **P3 done — French words speak too.** `seed:fr-word-audio`
    ([apps/ingest/src/sources/fr/word-audio.ts](apps/ingest/src/sources/fr/word-audio.ts))
    ingests **2,782** Lingua Libre recordings from Wikimedia Commons — **93% of the A1–B1 words**
    (2,782/3,000), 56% of all levelled French, from **17 different speakers**.
  - **No Commons category crawl was needed.** `Category:Lingua Libre pronunciation-fra` holds
    430,990 files (~860 paginated calls, and no word→file mapping). The kaikki French extract we
    **already download** for `seed:fr-kaikki-en` carries `sounds[].audio` + `sounds[].mp3_url` per
    entry, already joined to the headword. Re-reading that cached file replaces the whole crawl.
  - **Commons' mp3 transcode, not the source WAV**: `bonjour` is 117 KB as WAV and 15 KB as the
    transcode. Across thousands of clips that difference decides whether the feature ships at all.
    There is no `.opus`/`.oga` transcode, and no local re-encode (a fresh machine has no ffmpeg).
  - **Licenses are verified per file against the Commons API** (batched 50/call, cached to disk),
    never inferred from the filename — and that is what caught the biggest bug of this version.
  - **P4 done — TTS fallback, so no word is silent.** One shared `SpeakButton` picks a bundled
    recording, else the platform speech synthesiser, else renders **nothing at all** (never a
    button that cannot play). Synthetic playback is labelled `🔊TTS` and dashed-bordered: a
    learner copying a robot's Mandarin tones is worse off than one who knows to find a native
    model. Zero bundled bytes and zero licensing burden — nothing is downloaded or redistributed.
  - **Example sentences get TTS too**, and always will: Tatoeba's own sentence recordings are
    CC BY-NC-ND, so they can never be bundled. Synthesis is the only pronunciation they will have.
  - Two real browser failure modes, both found by testing rather than reasoning: Chrome populates
    `getVoices()` **asynchronously** (availability is read through `useSyncExternalStore` on
    `voiceschanged`, else the first render decides "no voice" forever), and Chrome **silently
    drops an utterance queued in the same task as `cancel()`** — which made every *repeat* press
    do nothing. Yield before re-speaking.
  - `pack verify` gained a gate: **every bundled clip must name its speaker.** Every clip is
    CC0/CC BY/CC BY-SA, and for the BY family naming the author is the licence's one real
    condition; a corpus-level credit cannot discharge it when Lingua Libre is hundreds of people.
  - Verified: `être` plays a 1.04 s decodable clip from a `blob:` URL with its credit rendered,
    voices arriving late light the button up, a recorded word never flashes as TTS, a repeat press
    speaks again after exactly one `cancel()`, and with no voice *and* no recording exactly 0
    buttons render. **0 off-origin requests, 0 console errors.**
    Script: `tools/e2e/verify-v04-p3-p4.mjs`.

- **v0.4 P3/P4 hardened after a second adversarial review** (4 lenses; 15 findings raised,
  **9 refuted, 6 confirmed**). Two of the nine refutations were themselves wrong and were
  reinstated after checking the code by hand — a refuter that refutes nothing is broken, but so
  is one trusted blindly. What was real:
  - **Every French clip was stamped `CC BY-SA 4.0`.** The per-file license was fetched from
    Commons, used as an accept/reject test, then thrown away while the INSERT hardcoded one
    constant. The truth, measured over all 2,782 files: **CC0 ×1870, CC BY-SA 4.0 ×902,
    CC BY 4.0 ×9, CC BY-SA 3.0 ×1** — so **68% of rows asserted ShareAlike obligations over
    recordings whose authors had dedicated them to the public domain.**
    [docs/RESEARCH-SOURCES.md](docs/RESEARCH-SOURCES.md) says "Lingua Libre uploads are
    CC BY-SA 4.0"; that is **wrong for most of the corpus**, and only per-file verification
    showed it. **No `pack verify` check could ever have caught this** — the license string was
    well-formed, just untrue. Treat a vetted source's stated license as a starting hypothesis.
  - **The speaker credit the new gate mandates was stored and never rendered.** `getWordAudioId`
    is now `getWordAudio` and returns speaker + attribution, shown beside the button.
  - **`audioId` conflated "lookup in flight" with "no recording exists"**, so a word we *do* have
    a native recording of painted as a synthetic-voice button for a worker round-trip — and a
    click in that window really did speak the robot. The three states are now distinct in the
    type: `undefined` = loading, `null` = none, row = play it.
  - **`await res.arrayBuffer()` sat outside the download try/catch.** undici resolves `fetch()`
    on *headers*, so one reset socket mid-body would escape the 100-failure budget and abort the
    whole seed — and under `seed:all`, the seeds after it too.
  - **The "permanently missing" markers were inert**: written as zero-byte files, then filtered on
    `size > 0`, so every known-404 was re-requested on every future run. They are a separate
    `.missing` sentinel now — a zero-byte mp3 means an *interrupted write*, which must retry, and
    the two must not look alike (`writeFileSync` is not atomic; `lib/download.ts` uses `.part`).
  - **TTS and recorded playback could talk over each other**; each path now stops the other.
  - **The test was wrong in the way that matters most.** Its `speechSynthesis` stub returned a
    full voice list on the first `getVoices()` and never fired `voiceschanged`, so the
    async-arrival path — one of the two failure modes P4 claims to handle — was never exercised.
    It now starts empty and delivers voices the way Chrome does, which **failed until the code was
    right**. A stub that is kinder than the real API is a test that passes for the wrong reason.

- **Crawl politeness is measured, not guessed.** upload.wikimedia.org answers **429 above ~2
  concurrent**: raising `polite()`'s budget to 8 made throughput *worse* (0.5 → 0.3 files/s) and
  lost files to refusals. Wikimedia's documented "~15,000 files/hour" describes their bulk
  tooling, not transcode URLs. The default (2 in flight, 250 ms apart) is right; the full crawl
  takes ~2 hours and is checkpointed, so an interrupted run resumes from cache. The license
  lookups are cached to disk too, so a resumed run re-asks Commons nothing.

- **⚠️ Pack size is now the open decision: 87.6 → 128.9 MB gz.** French audio added ~41 MB.
  Nothing is broken — it is a one-time download for a local-first app — but it should be a
  choice. The lever is one constant, `LEVELS` in
  [fr/word-audio.ts](apps/ingest/src/sources/fr/word-audio.ts); already-downloaded clips stay
  cached, so trimming costs only a re-run:
  `['A1','A2']` ≈ 1,977 clips (−14 MB) · `['A1']` ≈ 990 clips (−34 MB).
  Other levers, unchanged: drop zh word audio to `18k-abr` (−8 MB), restrict stroke data to
  HSK + top-N (−9 MB), or **split media into an optional second pack** — the real answer, which
  v0.9 (PWA + deploy) forces anyway.

- **Deliberately deferred: curated sentence audio** (the one 0.4 roadmap item not built). Filtered
  to bundleable licenses, Tatoeba offers ~6,663 English and ~2,126 French clips and **zero
  Mandarin** (all CK recordings are CC BY-NC-ND, the rest carry empty licenses). Sentence clips
  are far larger than word clips, so it would add heavily to an already-128 MB pack to buy
  coverage for two of three languages. TTS reads example sentences today. Revisit when media
  splits into its own pack.

- **v0.4 P1/P2 (built earlier in the version):**
  - **P1 done — every card has a real example.** `seed:sentences`
    ([apps/ingest/src/sources/shared/tatoeba.ts](apps/ingest/src/sources/shared/tatoeba.ts))
    ingests Tatoeba (CC BY 2.0 FR) filtered to words we actually ship. First run: 73,389
    sentences / 96,202 word links; **68,683 / 81,783 after the content and script filters
    below** — that smaller number is what ships, and is the one to trust.
    Coverage of levelled words at that first run: **HSK1 99% · HSK2 97% · HSK3 94% ·
    EN 93% · FR 94%**. ZH readings are generated with `pinyin-pro`, not taken from Tatoeba's
    patchy transcriptions export.
  - **Attribution is per sentence, not per corpus.** CC BY 2.0 FR requires crediting the
    contributor, so every row stores `sentence #<id> by <username>` and the UI always renders it.
    `pack verify` now **fails** on any sentence missing attribution, on orphan `word_sentences`,
    and on a zh sentence with no reading.
  - **Selection quality is deliberate.** Sentences are assigned shortest-first (simple examples,
    and they cover common words anyway) but with a substance floor — without it the "best"
    example for a word was 哈哈 / "Ok!" / "Si.", which are real Tatoeba sentences that teach
    nothing. Floors: ≥3 Han characters for zh, ≥12 characters for en/fr. Also caps: 3 examples
    per word, 30k sentences per language, ≤70 characters.
  - **Cards freeze their example** (`CardSnapshot.example`, optional so v0.2/v0.3 cards still
    validate). A review renders it from the snapshot — never by joining content.db (invariant 6).
  - Verified: word pages show reading + translation + credit; the review answer shows the frozen
    example with its credit; export → import round-trips a card carrying one.
    Script: `tools/e2e/verify-v04-p1.mjs`.
  - Pack: 47.5 → **57.7 MB gz** (sentences + their FTS index).
  - **P2 done — most words speak with a human voice.** `seed:zh-word-audio` ingests **7,211**
    HSK word recordings from `hugolpz/audio-cmn` — same repo as the syllable chart but a
    **different speaker and collection** (Yue Tan / cmn-caen-tan vs Chen Wang), so it registers
    its own `sources` row: the attribution has to name the right person. Only recordings that
    match a **levelled** pack word are downloaded at all, so a fresh machine doesn't pull 36 MB
    to discard a third of it. Coverage: **7,211 / 11,470 levelled zh words = 63%**.
  - Audio hangs off a new **`word_audio`** join table, not a `words.audio_id` column: audio comes
    from a different source than the word, and a word may later have several speakers.
  - **Deliberate, narrow exception to invariant 6:** the review card looks its audio up by card
    id instead of freezing it into the snapshot. Audio is *enrichment*, not card content — if the
    word vanishes from a newer pack the button simply disappears and the card still reviews.
    Freezing megabytes of mp3 into `user.db` would be far worse. Documented at `getWordAudioId`.
  - Verified: 🔊 on the word page and on the review answer both play a decodable clip from a
    `blob:` URL, **0 off-origin requests**, and the PLAN's v0.4 gate holds — **0 audio rows with
    NULL attribution, 0 NC/ND clips**. Script: `tools/e2e/verify-v04-p2.mjs`.
  - **Pack: 57.7 → 88.3 MB gz.** This is now the project's biggest open question. Levers, in
    order of how little they cost: drop word audio to `18k-abr` (−8 MB), restrict word audio to
    HSK1–6 (−12 MB), restrict stroke data to HSK + top-N frequency (−9 MB), or — the real answer —
    **split media into an optional second pack**, which v0.9 (PWA + deploy) will force anyway.
    Nothing is broken at 88 MB; it is a one-time download for a local-first app. But it should be
    a decision, not a drift.
  - **P1/P2 hardened after an adversarial review** (29 agents; 25 findings raised, 7 survived
    refutation, 18 refuted). Four were real and are fixed:
    - **No content filter.** Tatoeba is an open corpus and shortest-first selection actively
      *favours* its worst sentences. The rank-0 example was 操你妈！for HSK1 妈 ("mum"),
      殺了他/殺了她 for 他/她, and "I raped her." for A1 "her" — and `addCard` was freezing those
      into `user.db` permanently. `isBlocked()` now screens the sentence **and** its translation
      and rejects it outright; deranking would only make it example #2. **This is a denylist,
      not a guarantee** — it catches the egregious cases; an open corpus always holds more.
    - **Traditional-script sentences** (26.5% of zh) matched neither our simplified headwords,
      stroke animations nor audio, *and* broke transcription. Now rejected, using a
      traditional-only character set derived from our own lexicon (chars in `alt_form` but never
      in `headword`) rather than a hardcoded list.
    - **Wrong polyphones**: 嗎 read "má" in 307/307 sentences, 們 "mén" 590/590, 車 "jū" 125/125.
      Root cause was the traditional text above; on simplified-only input pinyin-pro is correct.
      Now 3 suspect syllables across 18,748 aligned sentences.
    - **Substring matching without segmentation** linked words that only straddled a boundary
      (有名 from 我没有名字, 人们 from 客人们, 大人 from 加拿大人). Replaced with greedy
      longest-match segmentation against our own headword list.
    - **Translations were uncredited.** The bundled English translation is a separate CC BY 2.0
      FR work by a different contributor; 45,983 rows now carry `translation #<id> by <user>`.
  - **A fix that looked right and was inert.** The blocklist was first written through a Python
    heredoc where `` became **literal backspace bytes (0x08)**, so the regex required a control
    character and matched nothing. Typecheck passed, the seed ran clean, counts looked plausible
    — only re-auditing the rebuilt data caught it. Use the Edit tool for regex/escape-heavy code.
  - **A fix that was worse than the bug.** Transcription was rebuilt on our own CC-CEDICT
    readings; measured, that was *worse* (吗 "má", 行 "háng", a capitalised "Néng" from a
    proper-noun entry) because one character's entries carry no sentence context. Reverted to
    pinyin-pro plus two targeted corrections — erhua (哪儿 "nǎr", 一块儿 too; 儿子 untouched) and
    the structural 得 (做得好 "zuò de hǎo"). **Known limitation:** 得 after a pronoun is left
    alone, since it is genuinely ambiguous there between modal děi (您得小心) and the verb dé
    (我得了金牌, which pinyin-pro reads correctly). Resolving it needs POS tagging.
  - Cost of the filtering: zh coverage of levelled words **71.2% → 63.4%** (HSK1 99% → 98%),
    en 92.6%, fr 94.0%. Pack 88.3 → **87.6 MB gz**. Worth it — a smaller set that is simplified,
    clean and correctly transcribed beats a larger one that is not.
  - Audit script: `tools/e2e/audit-v04-fixes.cjs`. It checks polyphones **character-aligned**,
    not by substring — a naive search flags 门 "mén", 儿子 "ér" and 德语 "dé" as errors when they
    are correct. Three of my own audit checks were wrong that way before being tightened.
  - **Seeds must delete before they insert.** Re-running with stricter filters left 77k rejected
    rows behind, because `INSERT … ON CONFLICT` upserts and never removes. `seed:sentences` now
    clears its own rows (scoped by `source_id`) first. Any seed whose *selection* can change
    needs this — an input-hash guard alone does not cover it.

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
    Script: `tools/e2e/verify-v03-p2.mjs` (it reads medians from the built pack itself and
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
    containing a grapheme card. 0 console errors. Script: `tools/e2e/verify-v03-p3.mjs`.
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
    is offline). Script: `tools/e2e/verify-v03-p4.mjs`.
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
    requests, 0 console errors. Script: `tools/e2e/verify-v03-p4b.mjs`.
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
    screen, 0 off-origin requests, 0 console errors. Script: `tools/e2e/verify-v03-p4c.mjs`.
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
    to the SRS deck. Script: `tools/e2e/verify-v03-p4d.mjs`.
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

## Next up: v0.9 — Real PWA

v0.8 is complete. See [docs/PLAN.md](docs/PLAN.md) for the 0.9 row (service worker + full offline
+ storage.persist() + pack update UI + backup nag + deploy to Cloudflare/GitHub Pages + iOS
Add-to-Home tested — "install on phone; study on the bus offline"). Its verify clauses in PLAN:
Lighthouse installable; a full airplane-mode session; pack N-1→N preserves all cards. **This is
also the version that forces the pack-size decision** deferred since v0.4: 130 MB is a heavy
first paint for a phone install, and splitting media into an optional second pack has been "the
real answer" in this file for four versions.

Carried forward from 0.8, none blocking:

1. **Cognates are word-level only.** The glyph pages (`/write/:glyph`) show no per-character
   Hán-Việt reading, deliberately: a character reading without an attested word invites exactly
   the composition trap the seed refuses. If ever added, keep it visually distinct from the
   attested cognates and label it "âm", not "từ".
2. **The simulator models one grade mix** (8/12/70/10 ≈ 92% pass). A learner with much lower
   retention will see more reviews than forecast. The mix is a named constant in
   [simulate.ts](packages/shared/src/srs/simulate.ts); parameterising it is cheap if wanted.
3. **`measuredSecondsPerCard` is global**, not per-language — zh cards plausibly take longer
   than en. Split when there is enough history for the split to mean something.
4. **The reach forecast ignores the daily budget cap** vs the slider: it divides by the slider
   value even if the learner's actual budget is lower. The slider defaults to the real budgets,
   so the mismatch only appears while experimenting — acceptable, but worth a label if noticed.

Carried forward from 0.7, none blocking:

1. **The term list is 161 concepts; growing it is editorial work, not code.** Add entries to
   [tech/terms.ts](apps/ingest/src/sources/tech/terms.ts) (exact article title + our slug +
   domain), re-run `seed:tech-vocab`, rebuild. The seed rejects disambiguation pages and missing
   articles loudly, so a bad title costs a log line, not bad data. Slugs are the ID contract —
   never rename one.
2. **27 terms have no Vietnamese name and 2 no Chinese.** That is Wikidata's real coverage today.
   If it matters, the fix is upstream (add the labels to Wikidata — they are CC0 and it takes a
   minute each) and a re-run picks them up; do not hand-patch the pack.
3. **Tech terms have no audio.** The term page and card offer English TTS only. Bundled
   pronunciation would need per-term recordings from a source not yet vetted.
4. **`domain` is a flat six-value tag.** Fine at 161 terms; revisit only if the list triples.

Carried forward from 0.6, none blocking:

1. **The daily pull has never run unattended.** Everything is verified by acceptance script and by
   one real pull today; the habit itself — thirty consecutive days, which is v1.0's gate — has not
   been exercised. The first thing that will break is the pinned VOA feed token; `/curate-pack`
   step 4 is where that gets noticed.
2. **`level_est` is a coverage measure, not a grading**, and it inherits v0.1's derived French
   CEFR bands, which put `cinquième` and `technologie` at C2 because they are frequency-derived
   over only 5,000 lemmas. The measure is honest about itself, but French levels are the weakest
   input it has.
3. **Chinese daily items carry no pinyin.** Word and sentence rows do; `daily_items` has no
   `reading` column, so a beginner reading VOA Chinese gets characters only. Adding one is cheap
   (`pinyin-pro` is already a dependency and `lib/pinyin.ts` exists) but was outside the 0.6 row.
4. **`license_mode='verbatim-only'` is STILL unexercised** — and v0.6 found the reason it keeps
   not happening. The natural candidate was The Conversation France (CC BY-ND, a vetted daily
   French source), and it is genuinely unusable here: ND forbids excerpting, so even a preview line
   on the Today card is a modification, *and* their republishing terms ask for a 1×1 tracking
   pixel, which an app whose every acceptance run asserts **0 off-origin requests** cannot serve.
   Worth recording as a verdict rather than a to-do.
5. **Old daily items are never pruned automatically.** `/curate-pack` step 3 does it by hand at 90
   days. At ~26 items a day that is ~2,300 rows before anyone notices — small, but it grows.
6. **The archive is 160 articles of a possible 32,737.** `QUOTA_PER_BAND` in
   [en/voa-le.ts](apps/ingest/src/sources/en/voa-le.ts) is the lever; the cost is one HTTP request
   per candidate, not bytes (160 articles are 673 KB of text).

Carried forward from 0.5, none blocking:

1. **The pack size decision.** 130.1 MB works but should be chosen, not inherited. Levers, in
   order of how little they cost: French word audio `LEVELS`
   ([fr/word-audio.ts](apps/ingest/src/sources/fr/word-audio.ts), −14 MB for A1+A2 only), zh word
   audio at `18k-abr` (−8 MB), stroke data restricted to HSK + top-N (−9 MB), or **split media
   into an optional second pack** — the real answer, which v0.9 forces anyway.
2. **Grammar is a reader, not a deck.** No grammar cards, no `CardSnapshot` change — that was
   outside the 0.5 row. If grammar ever becomes card-backed, revisit the Chinese IDs first: they
   key on the point's text, so an upstream rewording moves the ID, which is harmless for a reader
   and not for SRS state.
3. **The Tex audio link rides in `external_links` as a pseudo-URL** (`audio:<id>`), filtered out
   by the reader before rendering. Works, but if grammar examples ever grow past one clip per
   page, give them a real `grammar_examples` table instead of overloading a links column.
4. **`license_mode='verbatim-only'` is still unexercised.** Every grammar source so far is either
   `bundled` (Tex CC BY, Wikibooks CC BY-SA, the HSK list) or linked without a source row at all.
5. **地 has thinner coverage than 的 and 得.** All three link out, but if a bundled explanation is
   ever wanted, Wikibooks Chinese (Mandarin) Lesson 3 covers 的 and 得 and **not** 地.

**The v0.2 → v0.3 in-place upgrade is verified**, not assumed: an existing install on the
pre-v0.3 pack with real SRS state (cards, a review, a streak) upgrades on reload — pack version
advances, `user.db` is untouched, streak/daily stats/deck survive, v0.2-era cards still render
from their own snapshots, and every v0.3 feature works afterwards.
Script: `tools/e2e/verify-upgrade-v02-to-v03.mjs`.

If the pack update is unreachable (offline) the worker keeps the installed pack, which may
predate v0.3. `graphemes` has existed since v0.1, so those pages get **empty results, not
errors** — they now say so explicitly (`db.packTooOld`) instead of showing a bare empty grid.

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
pnpm ingest seed:all          # ~170 MB of downloads → apps/ingest/data-cache/ (gitignored), builds build/staging.db
pnpm pack:build && pnpm pack:verify
pnpm ingest pack publish      # copies pack into apps/web/public/packs/
pnpm dev                      # http://localhost:5173
```

**Budget ~2.5 hours for a first `seed:all`, almost all of it in one seed.**
`seed:fr-word-audio` fetches 2,782 individual files from Wikimedia Commons, which throttles to
roughly 2 concurrent requests — about 2 hours on its own. Everything else together is minutes.
It is checkpointed per file and caches its license lookups, so an interrupted run resumes
where it stopped; leave it running and come back. To skip it for a first look, run the other
seeds individually (`pnpm ingest seed:zh-cedict`, …) — French words then simply fall back to TTS,
and nothing else is affected. To bundle *less* French audio, narrow `LEVELS` in
[fr/word-audio.ts](apps/ingest/src/sources/fr/word-audio.ts) before the first run.

Notes:

- `seed:all` is idempotent and resumable; re-runs skip unchanged inputs (hash check).
  If a downloaded file's hash differs from `sources.lock.json`, you get a warning, not a failure — upstream moved; that's expected for CC-CEDICT (updated daily).
- **Fixing a parser is not enough to re-ingest** — the skip is keyed on the input hash, so bump
  the seed's `PARSER_VERSION` (it folds into the ingest hash, never the lock hash) or the corrected
  run is skipped as "unchanged". This has bitten twice; `zh-pinyin-audio` and `fr-word-audio` both
  carry one.
- The pack in `apps/web/public/packs/` is **gitignored** — every machine builds its own from sources (same stable IDs ⇒ same user progress compatibility).
- Acceptance scripts live in [tools/e2e/](tools/e2e/) (`cd tools/e2e && npm install`, then
  `node verify-v06.mjs` with `pnpm dev` running). They need an installed Chrome; set
  `CHROME=/path/to/chrome` if it is not in a standard location. **All 16 pass on v0.8.** One of
  them, `verify-upgrade-v02-to-v03.mjs`, must run against `static-server.mjs` rather than
  `pnpm dev` — see [tools/e2e/README.md](tools/e2e/README.md); running it in a blanket loop
  always "fails", which is how a real v0.4 bug stayed hidden until v0.6.
- `gh` CLI is optional: plain `git push` works with stored credentials; repo creation was done via API.

## The database (content pack) — what it is and how to use it

> **Tiếng Việt:** `content.db` là từ điển SQLite (147k từ EN/ZH/FR) được build tự động từ các
> nguồn miễn phí. KHÔNG sửa file .db bằng tay — muốn thêm dữ liệu thì viết/chạy module trong
> `apps/ingest` rồi build lại pack. File này không nằm trong git; máy khác lấy nó bằng cách
> tự build (cách A) hoặc tải từ GitHub Releases (cách B).

> **Size as of v0.8: 130.6 MB gz** (…128.9 in v0.4 → 130.1 in v0.5 → 130.4 in v0.6/v0.7 → 130.6). v0.9 forces the split-media decision.
> Roughly 86 MB of that is audio blobs and 30 MB is stroke JSON. The published v0.1 release asset
> is still the old 27.7 MB pack: it works, but has no `graphemes`/`hanzi_info`/`audio`/`sentences`,
> so `/write`, `/pinyin`, examples and every 🔊 will be empty. Rebuild from sources (way A) to get
> the writing, sentence and audio features. See the pack-size levers under "Current state".

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
| `apps/ingest/src/sources/fr/word-audio.ts` | (v0.4) Lingua Libre FR audio via Commons — mp3 transcodes found in the cached kaikki file; **license verified per file, never assumed**; `LEVELS` is the pack-size lever |
| `tools/e2e/` | (v0.4) the acceptance scripts every "Verified: …" line below refers to, plus a README of what each proves. No machine-specific paths — repo root is derived, Chrome comes from `$CHROME` |
| `apps/web/src/audio/tts.ts`, `components/speak-button.tsx` | (v0.4) speech-synthesis fallback + the one button both routes use: recording → synthesis → nothing. Synthetic playback is always labelled |
| `apps/web/src/routes/write.tsx`, `glyph.tsx` | (v0.3) `/write` browse-by-level/strokes, `/write/:glyph` animate · trace · decomposition · add writing card |
| `apps/web/public/licenses/ARPHICPL.TXT` | (v0.3) **must stay committed** — the Arphic PL requires redistributing its text; `pack verify` fails if it goes missing |
| `packages/shared` | ID derivation (contract!), Zod types, `src/srs/` = user.db schema + ts-fsrs wrapper (`@mls/shared/srs`) |
| `packages/content-pack` | schema.sql (contract!), pack builder/verifier |
| `sources.lock.json` | sha256 + license of every raw download (auto-maintained) |
| `.claude/skills/` | (v0.6) `/daily-pull` (the six-step daily contract) and `/curate-pack` (the weekly licence + liveness audit) |
| `apps/ingest/src/daily.ts` | (v0.6) the `daily:*` / `tips:add` CLI the skill drives; `daily:all` degrades per source instead of aborting |
| `packages/shared/src/wire.ts` | (v0.6) the wire-agency screen — a LICENCE rule, applied by ingest and re-applied by `pack verify`. 35% of VOA Learning English fails it |
| `apps/ingest/src/lib/level.ts` | (v0.6) measured difficulty: the band at which 90% of recognised words sit at or below. Not a CEFR grading; declines below 20 recognised tokens |
| `apps/web/src/routes/today.tsx` | (v0.6) `/today` — news, graded reading, word of the day → SRS, tip. Every section degrades rather than disappearing |

## Testing recipe (browser verification)

No test framework yet (deliberate — 0.1/0.2). End-to-end checks are ad-hoc Playwright scripts
driving an installed Chrome, and they live in **[tools/e2e/](tools/e2e/)** — see its
[README](tools/e2e/README.md) for what each one proves.

```sh
cd tools/e2e && npm install     # playwright-core only; it drives your own Chrome
pnpm dev                        # in another terminal, from the repo root
node verify-v04-p3-p4.mjs       # CHROME=/path/to/chrome if it is not in a standard location
```

They were kept in a scratch directory until v0.4, which meant every "Script: …" line in this file
was a dangling reference on any other machine. Nothing in there may be machine-specific now: the
repo root is derived from the script's own location and Chrome is discovered or taken from
`$CHROME`. New scripts should navigate to the dev server and wait for `input.searchbox` (pack
install can take ~1 min on the first run). See PLAN's per-version "Verify" bullets for what each
release must demonstrate.

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
- **To test a pack UPGRADE, serve the built app statically, not through `pnpm dev`** — Vite's
  watcher dies when `content.pack` is swapped. `tools/e2e/static-server.mjs` serves
  `apps/web/dist` with no watcher, which is what makes the upgrade test possible.
- `page.reload()` re-requests the *current* URL. After in-app navigation you are no longer on
  `/`, so don't wait for `input.searchbox` after a reload — wait for `footer.pack`.
- **Stop `pnpm dev` before `pnpm ingest pack publish`.** On Windows, overwriting
  `apps/web/public/packs/content.pack` while Vite watches it kills the dev server with `EBUSY`.
- To fast-forward the scheduler:
  `page.evaluate(ms => localStorage.setItem('mls_debug_clock_offset_ms', String(ms)), 4*864e5)`
  then reload. v0.2's acceptance run saw the "Good" interval grow 2 d → 16 d this way, and v0.3's
  grapheme card reproduced exactly the same 2 d → 16 d.
- **Navigate in-app (`page.click` on a nav `<a>`), not with `page.goto`, once the app is loaded.**
  A fresh document load can lose the exclusive OPFS handles to a page Chrome froze in the
  back/forward cache; you then get the (now friendly) "reload to continue" screen mid-test. This
  cost real debugging time — see the storage-lock note above. `tools/e2e/probe-locked.mjs`
  reproduces it deliberately.
- **To test the stroke quiz for real, replay the character's own medians as pointer events.**
  Read `graphemes.stroke_json` straight from the built pack, then invert hanzi-writer's Positioner:
  bounds are `(0,-124)..(1024,900)`, so with `width=height=260, padding=12`,
  `scale = 236/1024`, `xOffset = 12`, `yOffset = 124*scale + 12`, and
  `local = (cx*scale + xOffset, 260 - yOffset - cy*scale)`; add the SVG's `getBoundingClientRect()`
  origin. That is what proves the packed stroke data is *usable*, not merely present.
- `/review`'s done screen keeps `phase='done'` when you click the nav link to `/review` (same
  route ⇒ no remount). Click the done screen's own back button instead.
- **A stub kinder than the real API is a test that passes for the wrong reason.** Headless Chrome
  ships no speech-synthesis voices, so `window.speechSynthesis` has to be stubbed — and the first
  stub returned a full voice list from the very first `getVoices()` and never fired
  `voiceschanged`. Every assertion passed while the entire async-arrival path went unexercised.
  Model the API's *awkward* behaviour (empty first, event later), not its convenient one; the
  corrected stub failed until the code was actually right.
- **Assertions can encode the bug.** The same script asserted French credits matched
  `/CC BY-SA 4.0/` — the exact false assumption that the seed was hardcoding. It "passed" until
  real per-clip licenses arrived, then failed on correct data. When a test hardcodes a constant
  the code also hardcodes, it proves only that the two agree.
