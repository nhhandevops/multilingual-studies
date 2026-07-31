# Research: verified data sources & platform path (2026-07-29)

Output of a 10-agent research workflow (Claude Code) that verified every candidate
data source LIVE — pages fetched, license texts read — on 2026-07-29.
This file is the source of truth behind `sources.lock.json` and `LICENSES/SOURCES.md`.
Sections: ENGLISH / CHINESE / FRENCH / WRITING-SYSTEMS / LEARNING-SCIENCE / PLATFORM /
GAPS / FOLLOWUPS (fr-CEFR derivation, sentence audio, daily fresh content).
Legend: [RECOMMENDED] = adopt; [skip/low] = rejected, with the reason (license/dead/superseded) — kept so we never re-investigate.


========== ENGLISH ==========

### Wiktextract English dictionary (kaikki.org)  [RECOMMENDED]
URL: https://kaikki.org/dictionary/English/
WHAT: Machine-readable extraction of English Wiktionary: ~1,380,000 distinct English words with senses, part of speech, IPA, glosses, example sentences, translations, and audio-file URLs ('sounds' field). Per-language JSONL extracts plus raw all-language data (23.1 GB, 2.6 GB gzipped) and a 20.4 GB audio archive on the rawdata page (https://kaikki.org/dictionary/rawdata.html).
LICENSE: Underlying content is Wiktionary text: dual-licensed CC BY-SA 4.0 + GFDL 1.1+ (verified at Wiktionary:Copyrights). Redistribution inside a free or paid app is allowed; attribution and a link back to Wiktionary required; ShareAlike applies to the derived dataset (not your app code). Academic citation of the Wiktextract paper (Ylonen, LREC 2022) requested.
ACCESS: Bulk download: gzipped JSONL (one JSON object per word) from kaikki.org; filter fields you need and import into SQLite. No key, no API needed.
NOTES: Verified alive 2026-07-29. This is the best single source for bulk local import: definitions + POS + IPA + examples + audio links in one file. Large — preprocess to keep only needed senses/fields. The 3.0 GB 'all senses' file is marked deprecated; use the per-language English extract.

### dictionaryapi.dev (Free Dictionary API)  [RECOMMENDED]
URL: https://dictionaryapi.dev/
WHAT: Keyless JSON API for English: definitions per POS, phonetics with IPA, usage examples, and hosted audio (e.g. https://api.dictionaryapi.dev/media/pronunciations/en/hello-uk.mp3). Data sourced from Wiktionary.
LICENSE: API is free ('is—and always will be—free'). Live responses embed per-entry license fields: CC BY-SA 3.0 / BY-SA 4.0 for text, BY 3.0 US for some audio, with sourceUrls to Wiktionary. Cached/redistributed content inherits those CC terms (attribution + ShareAlike).
ACCESS: GET https://api.dictionaryapi.dev/api/v2/entries/en/<word>, no key. Verified working 2026-07-29 including audio URLs and license fields in the response.
NOTES: Good as an on-demand online fallback only. Hobby project: no SLA, history of outages and per-IP rate limiting; not suitable as the offline/bundled source (use kaikki.org for that). Old Google gstatic audio links in the docs example are legacy — current responses serve audio from the API's own domain.

### Wiktionary REST API  [RECOMMENDED]
URL: https://en.wiktionary.org/api/rest_v1/page/definition/hello
WHAT: Official Wikimedia REST endpoint returning per-language definitions grouped by part of speech with examples (HTML-marked-up strings). Covers any headword on English Wiktionary, all languages including EN/ZH/FR sections.
LICENSE: CC BY-SA 4.0 + GFDL 1.1+ (Wiktionary:Copyrights). Attribution via link back to the source page satisfies requirements.
ACCESS: Keyless REST, JSON. Verified working 2026-07-29. Set a descriptive User-Agent; respect Wikimedia rate-limit etiquette.
NOTES: Definitions come as HTML fragments needing cleanup; no IPA/audio in this endpoint (that requires parsing the page or using Wiktextract). Best for live lookups of words missing from your local DB.

### Open English WordNet  [RECOMMENDED]
URL: https://en-word.net/
WHAT: 120,564 synsets / 153,888 word entries: definitions, synonym sets, semantic relations (hypernyms, antonyms), example sentences. Fork of Princeton WordNet, actively maintained (annual releases) at github.com/globalwordnet/english-wordnet.
LICENSE: CC BY 4.0 (verified on site) — most permissive of all the dictionary options; redistribution in free or paid apps fine with attribution, no ShareAlike obligation.
ACCESS: Bulk downloads (XML, WNDB, RDF) from the site/GitHub releases plus a JSON API. Easy to load into SQLite.
NOTES: Verified alive 2026-07-29. No IPA or pronunciation audio — use it to complement Wiktextract for synonyms, word relations, and concise glosses, and as the fully-safe fallback if BY-SA ShareAlike ever worries you.

### FreeDict  [skip/low]
URL: https://freedict.org/downloads/
WHAT: 140+ bilingual dictionaries in TEI XML / StarDict / Slob. Relevant pairs are small: eng-fra 8,799 headwords, fra-eng 8,505. No English monolingual dictionary; no English-Vietnamese listed.
LICENSE: Free/copyleft ('right to study, change and modify... as long as you guarantee others these freedoms') — dictionaries are mostly GPL; check the per-dictionary metadata. Redistribution allowed incl. commercially, but GPL data bundling obliges you to pass on the license and source.
ACCESS: Bulk download TEI XML or StarDict archives; convert to SQLite.
NOTES: Verified alive 2026-07-29 (site updated Feb 2026). Too small and bilingual-only to matter for the English track; Wiktextract supersedes it. Low priority.

### NGSL — New General Service List (+ NAWL, TSL, BSL)  [RECOMMENDED]
URL: https://www.newgeneralservicelist.com/new-general-service-list
WHAT: ~2,800 core high-frequency headwords giving ~92% coverage of general English text; NGSL 1.2 (2023). Companion lists: New Academic Word List, TOEIC Service List, Business Service List. Downloads include frequency statistics and lemmatized forms.
LICENSE: Creative Commons Attribution-ShareAlike 4.0 International (verified on page). Redistribution in free/paid apps allowed with attribution to Browne, Culligan & Phillips.
ACCESS: Direct downloads: CSV (with frequency stats, lemmatized variants), TXT, and Excel with definitions.
NOTES: Verified alive and clean 2026-07-29 on the .com domain. WARNING: the mirror newgeneralservicelist.org showed injected gambling-spam footer content — use the .com site only. Ideal backbone for a beginner-to-intermediate study order.

### hermitdave/FrequencyWords  [RECOMMENDED]
URL: https://github.com/hermitdave/FrequencyWords
WHAT: Word-frequency lists ('word count' per line, e.g. en_50k.txt, full lists too) generated from OpenSubtitles 2016/2018 corpora, for dozens of languages — including en, fr and zh_cn, so it can serve all three tracks of the app.
LICENSE: CC BY-SA 4.0 for the content, MIT for the code (verified in repo README). Bundling allowed with attribution.
ACCESS: Plain-text files straight from GitHub (raw URLs or clone); trivially imported into SQLite.
NOTES: Verified alive 2026-07-29. Subtitle-based frequencies match conversational usage well — good proxy for the research-only SUBTLEX lists. Not recently regenerated, but frequency ranks age slowly.

### wordfreq (rspeer)  [RECOMMENDED]
URL: https://github.com/rspeer/wordfreq
WHAT: Blended word frequencies from 8 domains (Wikipedia, subtitles, news, books, web, Twitter, Reddit) for 40+ languages including English, Chinese and French; Python package with per-word Zipf scores.
LICENSE: Code: Apache License; data: CC BY-SA 4.0 (verified in README). Includes explicitly negotiated permission to redistribute the SUBTLEX-derived component under those terms.
ACCESS: pip package or extract the bundled msgpack data files; export to SQLite.
NOTES: Verified alive 2026-07-29. Data frozen at ~2021 snapshot by the author's choice — perfectly fine for ordering study vocabulary. The cleanest legal route to SUBTLEX-quality frequencies.

### google-10000-english  [skip/low]
URL: https://github.com/first20hours/google-10000-english
WHAT: 10,000 most common English words from Google's Trillion Word Corpus n-grams, with swear-free and US variants.
LICENSE: PROBLEMATIC: LICENSE.md permits 'educational and personal/research use... under the LDC license, Norvig's MIT license... and US fair use' and states 'I do not recommend using this data for commercial purposes without licensing it from the Linguistic Data Consortium.' Not a clean open license.
ACCESS: Plain-text files on GitHub.
NOTES: Verified alive 2026-07-29, but skip it: an app-store distribution (even free) sits in a legal grey zone under LDC terms, and FrequencyWords/wordfreq/NGSL cover the same need with clean CC licenses.

### SUBTLEX-US  [skip/low]
URL: https://www.ugent.be/pp/experimentele-psychologie/en/research/documents/subtlexus/overview.htm
WHAT: 74,286-word American English frequency norms from 51M words of film subtitles (frequency per million + contextual diversity). The classic psycholinguistics list.
LICENSE: PROBLEMATIC: official Ghent page states no license at all (verified 2026-07-29); historically distributed for research use. wordfreq's redistribution rests on private email permission from Brysbaert, not a public license.
ACCESS: Zipped Excel/TXT from the Ghent page; query tool at subtlexus.lexique.org.
NOTES: Old URL crr.ugent.be/programs-data/subtitle-frequencies now 404s; the ugent.be overview page above is alive. Do not bundle the raw file in a distributed app; get the same signal via wordfreq (CC BY-SA 4.0) or FrequencyWords.

### Oxford 3000 / Oxford 5000  [skip/low]
URL: https://www.oxfordlearnersdictionaries.com/about/wordlists/oxford3000-5000
WHAT: 3,000 core words (A1-B2) + 2,000 advanced words (B2-C1) with CEFR levels, curated by Oxford; downloadable PDFs incl. by-CEFR-level versions.
LICENSE: NOT REDISTRIBUTABLE: every PDF is stamped '© Oxford University Press' with no open license anywhere (verified 2026-07-29). Trademarked ('Oxford 3000™').
ACCESS: Free PDFs for personal use only from oxfordlearnersdictionaries.com.
NOTES: Confirmed as suspected: fine to consult personally, cannot be bundled in your SQLite DB or app. Use CEFR-J + Octanove (below) as the open substitute for CEFR grading.

### CEFR-J Vocabulary/Grammar Profiles + Octanove C1/C2 (Open Language Profiles)  [RECOMMENDED]
URL: https://github.com/openlanguageprofiles/olp-en-cefrj
WHAT: CEFR-J Vocabulary Profile v1.5: ~7,800 English words with CEFR-J levels (A1-B2) and POS, in CSV; Octanove Vocabulary Profile v1.0 adds C1/C2 vocabulary; CEFR-J Grammar Profile lists graded grammar items. Together: a full open A1→C2 graded wordlist.
LICENSE: CEFR-J datasets: 'can be used for research and commercial purposes with no charge, provided that you cite the dataset properly' (verified in README; copyright Tono Lab, TUFS). Octanove profile: CC BY-SA 4.0. Both redistribution-safe with citation/attribution.
ACCESS: CSV files directly in the GitHub repo. Derived convenience package: github.com/Maximax67/Words-CEFR-Dataset (MIT repo offering a ready-made 20 MB SQLite DB + CSVs merging CEFR-J levels with POS and Google n-gram frequencies — keep the CEFR-J citation).
NOTES: Verified alive 2026-07-29. This is the recommended open replacement for Oxford 3000/5000. Grammar profile is partially in Japanese; usable as a graded topic checklist.

### Kelly list (English M3)  [skip/low]
URL: https://ssharoff.github.io/kelly/
WHAT: ~9,000-word corpus-derived English learner list with CEFR levels (A1-C2) and per-million frequencies, from the EU KELLY project (9 languages incl. English and Chinese).
LICENSE: PROBLEMATIC: page states 'The lists are available under the CC BY-NC-SA 2.0 license' (verified 2026-07-29) — NonCommercial clause makes app-store bundling risky even for a free app.
ACCESS: Direct download en_m3.xls (Excel) from the Leeds page.
NOTES: Alive but NC-flagged. Fine for private personal experimentation; do not ship it. CEFR-J + Octanove covers the same ground with clean terms.

### EFLLex (CEFRLex project, UCLouvain)  [skip/low]
URL: https://cental.uclouvain.be/cefrlex/efllex/
WHAT: 15,280 English lemmas with normalized frequency distributions across CEFR levels A1-C1, derived from graded textbooks/readers. Sister resources: FLELex (French), each per-level frequency in TSV.
LICENSE: CEFRLex resources are historically distributed under CC BY-NC-SA (NonCommercial — problematic for bundling). Could not verify current text because the server is DOWN.
ACCESS: TSV download from the CENTAL site when reachable.
NOTES: DEAD/UNREACHABLE at check time: connection refused on both HTTP and HTTPS, 2026-07-29 (two attempts). Combined with the NC license, do not build on it; treat as unavailable.

### Tatoeba sentence corpus + API  [RECOMMENDED]
URL: https://tatoeba.org/en/downloads
WHAT: Millions of user-contributed example sentences with translations across languages (large EN, FR, ZH coverage). Weekly TSV exports: sentences (+POS-less plain text, language codes), sentence pairs per language pair, links, tags, transcriptions, audio metadata, and per-user self-reported skill levels. Keyless REST API with OpenAPI spec at https://api.tatoeba.org/ (search + download endpoints).
LICENSE: Sentences: CC BY 2.0 FR (verified on downloads page + FAQ); a subset is CC0 1.0. Attribution required per sentence (contributor + link to tatoeba.org) — store the sentence ID and username in your SQLite rows. AUDIO IS DIFFERENT: per-file contributor-chosen licenses incl. CC BY-NC variants — filter by license before bundling any audio.
ACCESS: Bulk TSV downloads (weekly exports) — ideal for SQLite import; API for live search. No key.
NOTES: Verified alive 2026-07-29. Best free example-sentence source for all three of your languages; sentence pairs give EN↔FR↔ZH↔VI links too. Quality varies (user-generated); prefer sentences from native speakers/high review scores.

### CEFR-SP / SCoRE (graded sentences)  [skip/low]
URL: https://github.com/yukiar/CEFR-SP
WHAT: 17k English sentences annotated with CEFR levels by English-education professionals (EMNLP 2022) — the main open-ish 'graded sentences' dataset; sampled from Newsela-Auto, Wiki-Auto and SCoRE.
LICENSE: PROBLEMATIC: each subset inherits its upstream license — the Newsela portion requires a Newsela data agreement, and SCoRE is CC BY-NC-SA (NonCommercial). Only the Wiki-Auto-derived part is CC-compatible.
ACCESS: GitHub repo (partly; Newsela portion gated).
NOTES: Verified via search 2026-07-29. Not bundle-safe as a whole. Practical alternative for graded sentences: order Tatoeba sentences yourself by NGSL/CEFR-J vocabulary coverage — fully within CC BY 2.0 FR terms.

### Wikimedia Commons pronunciation audio (incl. Lingua Libre)  [RECOMMENDED]
URL: https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation-eng
WHAT: Hundreds of thousands of single-word pronunciation recordings (ogg) for English (also huge French and Mandarin sets), linked from Wiktionary entries; Lingua Libre mass-recording project feeds Commons automatically.
LICENSE: Per-file free licenses — Lingua Libre uploads are CC BY-SA 4.0; older Commons files are CC BY-SA/CC BY/public domain. All are redistribution-safe; you must store author + license per file and credit them (a licenses screen in the app satisfies this).
ACCESS: Three routes: (1) the audio URLs already embedded in kaikki.org Wiktextract 'sounds' fields (plus kaikki's 20.4 GB bulk audio archive), (2) Commons API by category, (3) Lingua Libre datasets. No key.
NOTES: Commons verified alive 2026-07-29; Lingua Libre project status 'Active' per Meta-Wiki but its wiki is mid-migration (lingualibre.org redirects to archive.lingualibre.org, which returned HTTP 426) — fetch audio via Commons, not via lingualibre.org. dictionaryapi.dev audio links also still work (verified) but Commons is the bundle-safe source.

### Wikibooks: English in Use + English Grammar  [RECOMMENDED]
URL: https://en.wikibooks.org/wiki/English_in_Use
WHAT: Free grammar textbooks: 'English in Use' (75% developed, last edited June 2026) covers parts of speech, sentence structure, agreement, punctuation, syntax — suitable intermediate→advanced; 'English Grammar' (https://en.wikibooks.org/wiki/English_Grammar) is a simpler companion; Simple English Wikibooks has beginner material.
LICENSE: CC BY-SA 4.0 (+GFDL) — verified. Fully redistributable in the app with attribution and ShareAlike on the text.
ACCESS: Scrape/export via the MediaWiki API (action=parse or REST /page/html), or Wikibooks XML dumps; convert to Markdown/HTML for SQLite.
NOTES: Verified alive 2026-07-29. The only large redistributable English grammar reference; some chapters incomplete ('Fragments and Run-on Sentences' missing). Curate and lightly edit per CEFR topic list from the CEFR-J Grammar Profile.

### Wikipedia technical glossaries + Wikibooks Embedded Systems (IoT vocabulary)  [RECOMMENDED]
URL: https://en.wikipedia.org/wiki/Glossary_of_electrical_and_electronics_engineering
WHAT: Glossary of electrical and electronics engineering (~1,000+ term/definition pairs, verified), plus Glossary of engineering, Glossary of computer science on Wikipedia; Wikibooks 'Embedded Systems' book incl. a Terminology chapter (https://en.wikibooks.org/wiki/Embedded_Systems/Terminology) and 'Embedded Control Systems Design'. Ready-made term+definition pairs for an IoT/electronics professional-vocab module.
LICENSE: CC BY-SA 4.0 (Wikipedia/Wikibooks text) — redistributable with attribution (link to article) and ShareAlike.
ACCESS: MediaWiki API (parse glossary pages into term/definition rows) or dumps; glossaries use structured dt/dd markup that parses cleanly.
NOTES: Verified alive 2026-07-29. Pair each glossary term with IPA/audio from the Wiktextract data where the word exists as a dictionary headword. Definitions are technical rather than learner-graded — consider simplifying (allowed as a derivative under BY-SA).

--- SUMMARY (english): Recommended English-track stack, all verified alive on 2026-07-29 and all bundle-safe: (1) Core offline dictionary = kaikki.org Wiktextract English JSONL (definitions, POS, IPA, examples, audio URLs; CC BY-SA 4.0 + GFDL) imported into SQLite, complemented by Open English WordNet (CC BY 4.0) for synonyms/relations; dictionaryapi.dev and the Wiktionary REST API stay as keyless online fallbacks only. (2) Study ordering = NGSL (CC BY-SA 4.0) as the beginner backbone, frequency ranks from hermitdave/FrequencyWords or wordfreq data (both CC BY-SA 4.0; both also cover FR and ZH, so one pipeline serves all three tracks). (3) CEFR grading = CEFR-J Vocabulary Profile (free for commercial use with citation) + Octanove C1/C2 profile (CC BY-SA 4.0) — this fully replaces Oxford 3000/5000, which is confirmed © Oxford University Press with no open license and must not be bundled; Kelly (CC BY-NC-SA 2.0) and EFLLex (NC license, server currently unreachable) are also out. (4) Example sentences = Tatoeba TSV exports (CC BY 2.0 FR; store per-sentence contributor attribution in SQLite; skip its audio unless per-file license checks pass); generate graded sentences by ranking Tatoeba against NGSL/CEFR-J coverage instead of using the license-encumbered CEFR-SP. (5) Audio = Wikimedia Commons/Lingua Libre recordings via the audio URLs already inside Wiktextract entries (CC BY-SA 4.0 per file — store author+license). (6) Grammar = Wikibooks 'English in Use' + 'English Grammar' (CC BY-SA), sequenced by the CEFR-J Grammar Profile. (7) IoT vocabulary = Wikipedia glossaries of electrical/electronics engineering and computer science plus the Wikibooks Embedded Systems terminology chapter (CC BY-SA). Because nearly everything is CC BY-SA, ship an attribution/licenses screen in the app and publish the compiled dataset under CC BY-SA; also flagged as NOT bundle-safe: google-10000-english (LDC terms) and raw SUBTLEX-US (no public license — use wordfreq's cleanly licensed equivalent instead).

========== CHINESE ==========

### CC-CEDICT (via MDBG)  [RECOMMENDED]
URL: https://www.mdbg.net/chinese/dictionary?page=cc-cedict
WHAT: The standard open Chinese-English dictionary: 124,726 entries (verified 2026-07-29), each line = Traditional Simplified [pin1 yin1] /English def 1/def 2/. Covers words, proper nouns, classifiers/measure words. Both charsets in one UTF-8 file.
LICENSE: CC BY-SA 4.0 (verified on the MDBG CC-CEDICT page). Redistribution in free AND paid apps is allowed; must credit CC-CEDICT and share any improvements to the dictionary data under BY-SA. BY-SA applies to the data, not your app code.
ACCESS: Bulk download, keyless: cedict_1_0_ts_utf-8_mdbg.zip or .txt.gz from the MDBG export page (https://www.mdbg.net/chinese/export/cedict/). Plain text, trivially parseable into SQLite.
NOTES: Verified alive; release timestamp was same-day (updated near-daily as submissions are processed). This is the backbone for the Chinese track — English glosses only (no Vietnamese/French), pinyin uses tone numbers with u: for u-umlaut.

### drkameleon/complete-hsk-vocabulary  [RECOMMENDED]
URL: https://github.com/drkameleon/complete-hsk-vocabulary
WHAT: Single JSON dataset merging HSK 2.0 (levels 1-6) and HSK 3.0 (levels 1-6 + 7-9): simplified, traditional, radical, HSK level in both schemes, frequency rank, POS, pinyin/zhuyin/Wade-Giles, definitions, classifiers. Also per-level wordlists (inclusive and exclusive).
LICENSE: MIT (repo license, verified). Caveat: definitions appear CEDICT-derived, so keep CC-CEDICT attribution alongside; the HSK lists themselves are PRC government standard content (GF0025-2021), widely treated as freely reusable and republished by many repos with no known takedowns, but never formally licensed by MOE.
ACCESS: GitHub bulk download (clone or raw JSON files), keyless. Files auto-regenerated via GitHub Actions.
NOTES: Verified alive and maintained. Best single source because it covers BOTH HSK 2.0 and 3.0 in one schema — ideal for a beginner-to-fluent level system in SQLite.

### ivankra/hsk30 (cleaned HSK 3.0 CSVs)  [RECOMMENDED]
URL: https://github.com/ivankra/hsk30
WHAT: Cleaned HSK 3.0 data: hsk30.csv (11,092 words with simplified/traditional, pinyin, POS, level 1-6/7-9), hsk30-chars.csv (3,000 characters incl. handwriting-required subsets), hsk30-grammar.csv (official grammar points per level), plus the cleaning notebook.
LICENSE: MIT for the repo; data OCR'd from the official MOE PDF and the official HSK query system (PRC government work, arguably exempt from copyright under PRC Copyright Law Art. 5, but not formally licensed).
ACCESS: GitHub raw CSV download, keyless.
NOTES: Verified alive; stable rather than actively developed. The hsk30-grammar.csv is notable: it is the OFFICIAL graded grammar-point list — a truly open alternative skeleton to the (NC-licensed) Chinese Grammar Wiki for a grammar syllabus.

### elkmovie/hsk30 (raw official HSK 3.0 lists)  [skip/low]
URL: https://github.com/elkmovie/hsk30
WHAT: Plain-text HSK 3.0 wordlist and character list extracted (Pleco OCR) from the official MOE announcement PDF (linked in repo: http://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202103/t20210329_523304.html).
LICENSE: MIT (verified on repo page); same government-work caveat for the underlying lists.
ACCESS: GitHub raw text files, keyless.
NOTES: Verified alive. Useful as the provenance-closest raw source; ivankra and drkameleon build on it. Use one of those instead unless you want to re-derive from scratch.

### krmanik/HSK-3.0  [skip/low]
URL: https://github.com/krmanik/HSK-3.0
WHAT: HSK 3.0 (1-9) hanzi, handwriting, word and grammar lists as TSV/JSON, enriched with frequency, pinyin, zhuyin and meanings; also BCT/YCT lists.
LICENSE: Mixed per License.md (verified): CC BY-SA 4.0 for CC-CEDICT- and SUBTLEX-derived columns, MIT for Pleco-derived wordlist and code. Redistribution fine with attribution; BY-SA columns keep BY-SA.
ACCESS: GitHub bulk download, keyless.
NOTES: Verified alive, updated as recently as 2025-11. Richest single HSK repo, but mixed licensing means per-column attribution bookkeeping; drkameleon is simpler to consume.

### hanzi-writer (JS library)  [RECOMMENDED]
URL: https://github.com/chanind/hanzi-writer
WHAT: JS library for stroke-order animation and interactive stroke-order quizzes (draw-on-screen with grading), simplified + traditional. Exactly the engine needed for step-by-step character writing practice.
LICENSE: MIT (verified). Bundling in a free or paid app is fine.
ACCESS: npm package `hanzi-writer`; data loaded from hanzi-writer-data (bundle locally instead of CDN for a local-first PWA).
NOTES: Verified alive and maintained, live demo works. De-facto standard; used by many commercial apps.

### hanzi-writer-data  [RECOMMENDED]
URL: https://github.com/chanind/hanzi-writer-data
WHAT: Per-character JSON (SVG stroke outlines + median points) for ~9,000+ common simplified and traditional characters, derived from makemeahanzi.
LICENSE: Arphic Public License (ARPHICPL.TXT in repo, verified full text): free copying, modification, redistribution INCLUDING in commercial products; conditions = ship the unaltered APL license text with the data, keep the data itself under APL (copyleft on the data, not your app), don't charge for the data itself. Bundling inside a free or paid app-store app is OK — include ARPHICPL.TXT and credit Arphic/makemeahanzi in your licenses screen.
ACCESS: npm `hanzi-writer-data` or GitHub bulk download; one small JSON per character — fits SQLite blobs nicely.
NOTES: Verified alive. This is the standard companion data for hanzi-writer. APL copyleft applies only to the stroke data files, so a closed-source app can still bundle them.

### makemeahanzi  [RECOMMENDED]
URL: https://github.com/skishore/makemeahanzi
WHAT: Source project behind hanzi-writer-data. graphics.txt: per-character SVG stroke paths in stroke order + medians (9,000+ chars). dictionary.txt: character, pinyin, definition, structural DECOMPOSITION (IDS), etymology (pictogram/ideogram/phono-semantic with hint), radical, stroke-to-component matches.
LICENSE: Per COPYING (verified): graphics.txt + svgs = Arphic Public License (bundleable, see hanzi-writer-data entry); dictionary.txt = LGPL v3+ (derived from Unihan + CJKlib). LGPL on a data file is unusual but bundling data (not linking code) with attribution and license text is accepted practice; keep dictionary.txt as a separate, replaceable file/table to stay clearly compliant.
ACCESS: GitHub bulk download, keyless; line-per-character JSON in both files.
NOTES: Verified alive (2.6k stars, maintained). dictionary.txt is the best one-stop decomposition + radical + etymology source for a learning app.

### cjkvi-ids (character decomposition)  [skip/low]
URL: https://github.com/cjkvi/cjkvi-ids
WHAT: Ideographic Description Sequences (component decompositions) for the full CJK Unified Ideographs range — much wider coverage than makemeahanzi (all of Unicode CJK, incl. rare chars).
LICENSE: GPLv2 (verified README); the main ids.txt additionally carries CHISE-project conditions. GPL-licensed DATA bundled into a closed-source app is legally murky (arguments exist that the app becomes a combined work). Flag: prefer makemeahanzi dictionary.txt (LGPL) or Unihan for a store-distributed app; if you use cjkvi-ids, use ids-ext-cde.txt (plain GPLv2, no CHISE restriction) and get comfortable with GPL data bundling, or skip.
ACCESS: GitHub raw text files, keyless.
NOTES: Verified alive. Only needed if you want decomposition beyond the ~9,000 makemeahanzi characters — unlikely for a learner app.

### Unihan Database (Unicode)  [RECOMMENDED]
URL: https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip
WHAT: Per-codepoint data for every CJK ideograph: kMandarin (pinyin), kDefinition, kRSUnicode radical-stroke, kTotalStrokes, kSimplified/TraditionalVariant, kGradeLevel, frequency fields. The authoritative radical/variant backbone.
LICENSE: Unicode License v3 (verified at https://www.unicode.org/license.txt): permissive MIT-style — use, modify, distribute, sell allowed; only requirement is retaining the copyright/permission notice.
ACCESS: Bulk zip download, keyless; tab-separated codepoint/field/value text files.
NOTES: Verified alive. Cleanest-licensed source for radicals, variants, stroke counts, and character-level pinyin readings.

### pinyin-pro (npm)  [RECOMMENDED]
URL: https://github.com/zh-lx/pinyin-pro
WHAT: Best-in-class JS hanzi-to-pinyin conversion: polyphone (多音字) disambiguation with word segmentation, tone marks or tone numbers, initials/finals/tone extraction (perfect for generating tone-pair drill metadata), pinyin-input matching.
LICENSE: MIT (verified). Bundling fine.
ACCESS: npm `pinyin-pro`; pure JS, works offline in a PWA.
NOTES: Verified alive, actively maintained, 4.7k stars. Use it to auto-pinyin Tatoeba sentences and to compute tone categories for tone-pair drills (no canonical open 'tone-pair dataset' exists — generate pairs from HSK vocab + this library). Alternative `pinyin` (hotoo) exists but pinyin-pro has better accuracy/docs.

### hugolpz/audio-cmn (Shtooka/SWAC Mandarin recordings)  [RECOMMENDED]
URL: https://github.com/hugolpz/audio-cmn
WHAT: 1,707 pinyin SYLLABLE recordings (full pinyin chart across tones) + 8,596 HSK word recordings by native speakers (cmn-caen-tan collection, speakers Chen Wang & Yue Tan), pre-encoded at multiple MP3 bitrates.
LICENSE: CC BY-SA (verified in README, per-speaker attribution). Redistribution in free/paid apps OK with credit to the speakers/project and share-alike on the audio files.
ACCESS: GitHub bulk download, keyless — this is the surviving mirror of the Shtooka project audio (shtooka.net itself is DEAD: domain now 301-redirects to an unrelated site, verified).
NOTES: Verified alive. This solves both the pinyin-chart-with-tones audio AND legal per-word audio for ~8.6k HSK-2.0-era words in one CC-licensed package. AllSet Learning's and Yoyo Chinese's pinyin chart audio are proprietary — do NOT scrape/bundle those.

### davinfifield/mp3-chinese-pinyin-sound  [skip/low]
URL: https://github.com/davinfifield/mp3-chinese-pinyin-sound
WHAT: Pinyin syllable MP3s covering the syllable/tone chart.
LICENSE: Labeled Unlicense (public domain) on GitHub, BUT the README states no provenance for the recordings (verified — README is one line). The uploader may not have had rights to the audio.
ACCESS: GitHub bulk download, keyless.
NOTES: Alive, but flagged: unverifiable provenance makes it risky to bundle in a store app. Use hugolpz/audio-cmn instead, which has documented speakers and license.

### SUBTLEX-CH word/character frequencies  [RECOMMENDED]
URL: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0010729
WHAT: Word, word+POS, and character frequency lists from a 33.5M-word (46.8M-character) film-subtitle corpus — frequencies that best predict learner-relevant, spoken-style usage. ~99k words / ~5.9k characters.
LICENSE: The dataset distributed as PLOS ONE supporting information is under the Creative Commons Attribution (CC BY) license (verified via article/search: 'unrestricted use, distribution, and reproduction... provided the original author and source are credited'). The copies on the UGent site (https://www.ugent.be/pp/experimentele-psychologie/en/research/documents/subtlexch) say 'free access for research purposes' — so download from the PLOS supplementary files to rely on CC BY, and cite Cai & Brysbaert (2010).
ACCESS: Bulk download of supplementary zip/xls from the PLOS article page, keyless. Convert to SQLite.
NOTES: Verified alive. Best license-clean frequency source for ordering vocab and grading sentence difficulty.

### BLCU BCC corpus frequency lists (BCC_LEX_Zh)  [skip/low]
URL: http://bcc.blcu.edu.cn/
WHAT: Word frequency lists from BLCU's 15-billion-character balanced corpus (news, literature, blogs, weibo), global + per-genre lists (global_wordfreq.release).
LICENSE: NO explicit license (verified: no license found; the old direct zip link http://bcc.blcu.edu.cn/downloads/resources/BCC_LEX_Zh.zip now lands on the corpus homepage). Redistribution rights unclear — flag as problematic for bundling.
ACCESS: Was a direct zip download; currently unreliable. Community mirrors exist on Pleco forums (https://www.plecoforums.com/threads/word-frequency-list-based-on-a-15-billion-character-corpus-bcc-blcu-chinese-corpus.5859/).
NOTES: Great data but murky license and flaky hosting. Use SUBTLEX-CH (CC BY) + hermitdave (CC BY-SA) instead for anything you ship.

### hermitdave/FrequencyWords (zh_cn)  [RECOMMENDED]
URL: https://github.com/hermitdave/FrequencyWords
WHAT: OpenSubtitles-2018-derived frequency lists; zh_cn_full.txt and zh_cn_50k.txt verified present (also en, fr — reusable across all three app tracks).
LICENSE: CC BY-SA 4.0 for the lists, MIT for code (verified in README). Bundling OK with attribution + share-alike on the list data.
ACCESS: GitHub raw text download, keyless. Format: 'word count' per line.
NOTES: Verified alive. Caveat: Chinese word segmentation from subtitles is noisy — treat as a secondary signal to SUBTLEX-CH.

### Tatoeba (Mandarin sentences + transcriptions)  [RECOMMENDED]
URL: https://tatoeba.org/en/downloads
WHAT: 88,509 Mandarin (cmn) sentences (verified 2026-07), 2.04M English, 729k French — crowd-translated pairs, plus a separate transcriptions export that includes Mandarin readings, plus per-sentence audio for a subset.
LICENSE: Sentences: CC BY 2.0 FR by default, with a CC0 1.0 subset (sentences_CC0 export) — verified on downloads page. Attribution per sentence (link to sentence/author) required for CC BY; both fine in free/paid apps. AUDIO is per-contributor licensed — many files are NOT reusable; check each file's stated license before bundling.
ACCESS: Bulk downloads, keyless: per-language exports (e.g. per_language/cmn/cmn_sentences.tsv.bz2), links.csv for translation pairs, transcriptions export, weekly regenerated.
NOTES: Verified alive. Quality varies (crowd-sourced; some translationese) — filter by user reputation/OK tags and sort by SUBTLEX frequency. Auto-generate missing pinyin with pinyin-pro rather than relying on transcription coverage.

### Chinese Grammar Wiki (AllSet Learning)  [RECOMMENDED]
URL: https://resources.allsetlearning.com/chinese/grammar/Main_Page
WHAT: The most comprehensive graded English-language Chinese grammar reference (2,000+ articles, A1-C1 graded grammar points with examples).
LICENSE: CC BY-NC-SA 3.0 (verified via the wiki's own Copyrights page, https://resources.allsetlearning.com/chinese/grammar/Chinese_Grammar_Wiki:Copyrights: content 'may not be used for commercial purposes'; AllSet explicitly states even ad-supported apps don't qualify). DO NOT bundle in an app-store app. Linking out to wiki pages from your app is fine and is the recommended pattern (site verified alive; direct fetch is bot-blocked with 403 but the site works in browsers).
ACCESS: Web only for reference/linking. A scraped copy exists at github.com/ivankra/asg — same NC license applies, so still not bundleable.
NOTES: Map your grammar syllabus to ivankra/hsk30's official hsk30-grammar.csv (open) and store deep links to matching Grammar Wiki URLs for 'learn more'.

### Wikibooks: Chinese (Mandarin)  [RECOMMENDED]
URL: https://en.wikibooks.org/wiki/Chinese_(Mandarin)
WHAT: Free textbook: pinyin/pronunciation basics, tones, 17 graded lessons (greetings through intermediate topics), grammar notes, vocab appendices. ~75% developed (verified).
LICENSE: CC BY-SA 4.0 (Wikibooks standard footer, verified). Bundling excerpts in free/paid apps OK with attribution + share-alike on the text.
ACCESS: Web, MediaWiki API (keyless), or Wikimedia dumps (dumps.wikimedia.org) for bulk export.
NOTES: Verified alive (edits reviewed July 2026). The only truly open bundleable English-language Chinese grammar prose; shallower than Grammar Wiki but redistributable.

### Wikimedia Commons Chinese pronunciation audio (incl. Lingua Libre)  [RECOMMENDED]
URL: https://commons.wikimedia.org/wiki/Category:Chinese_pronunciation
WHAT: ~5,159 files in Category:Chinese pronunciation (Zh-*.ogg word/syllable recordings) + 4,122 Mandarin recordings in Category:Lingua Libre pronunciation-cmn (both counts verified 2026-07). Growing via Lingua Libre's recording tool.
LICENSE: Per-file, but effectively all CC BY-SA 4.0 or freer (Lingua Libre uploads are CC BY-SA 4.0). Bundling OK with per-file attribution (speaker + license) — store attribution rows in SQLite.
ACCESS: Keyless: Commons API / petscan for file lists, direct file URLs for download; Lingua Libre also offers per-language dataset zips (https://lingualibre.org/datasets/, JS-heavy page).
NOTES: Verified alive. Coverage (~9k files total) is small versus CC-CEDICT's 124k entries — combine with hugolpz/audio-cmn for HSK words and fall back to TTS elsewhere.

### Forvo API  [skip/low]
URL: https://api.forvo.com/plans-and-pricing/
WHAT: Crowd-sourced native pronunciations (6M+ words, strong Mandarin coverage).
LICENSE: NOT free (verified 2026-07): no free tier — Non-Profit $2/mo (500 req/day, non-commercial only), Commercial from $28.95/mo. API terms do not grant redistribution/bundling of audio files.
ACCESS: Keyed paid REST API only.
NOTES: Fails the 'free, no recurring cost, bundleable' requirements twice over. Skip; listed to confirm status.

### On-device TTS (Web Speech API / platform TTS)  [RECOMMENDED]
URL: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
WHAT: speechSynthesis with zh-CN voices in the PWA; AVSpeechSynthesizer (iOS) and Android TextToSpeech when packaged. Covers pronunciation for ANY word/sentence with zero licensing burden since no audio is redistributed.
LICENSE: Free platform capability; no redistribution involved, no attribution needed.
ACCESS: Built-in JS/native APIs, offline-capable with downloaded system voices (iOS/Android ship good zh-CN voices).
NOTES: Quality on modern iOS/Android Mandarin voices is decent though tone-perfect but robotic; use recorded audio (audio-cmn, Commons) where available and TTS as the universal fallback.

--- SUMMARY (chinese): Backbone: CC-CEDICT (CC BY-SA 4.0, 124.7k entries, updated near-daily, verified alive today) as the dictionary table; drkameleon/complete-hsk-vocabulary (MIT) for a unified HSK 2.0+3.0 level system, with ivankra/hsk30 adding the official 3,000-char list and the official graded grammar-point CSV. Writing practice: hanzi-writer (MIT) + hanzi-writer-data/makemeahanzi graphics (Arphic Public License — bundleable in a store app if you ship ARPHICPL.TXT and credit Arphic/makemeahanzi); decomposition/radicals from makemeahanzi dictionary.txt (LGPL3) plus Unihan (permissive Unicode License v3); avoid cjkvi-ids (GPLv2) unless you need full-Unicode coverage. Pinyin: pinyin-pro (MIT) for conversion and for generating tone-pair drills; hugolpz/audio-cmn (CC BY-SA) is the key audio find — 1,707 recorded pinyin syllables (full tone chart) + 8,596 HSK word recordings, legally redistributable (original shtooka.net is dead — domain squatted). Frequency: SUBTLEX-CH via PLOS supplementary files (CC BY) primary, hermitdave/FrequencyWords zh_cn (CC BY-SA) secondary; skip BCC/BLCU (no license, flaky hosting). Sentences: Tatoeba cmn (88.5k sentences, CC BY 2.0 FR + CC0 subset, keyless bulk exports) with pinyin auto-generated by pinyin-pro. Grammar: the Chinese Grammar Wiki is confirmed CC BY-NC-SA 3.0 — NC means you must deep-LINK, not bundle; bundle Wikibooks Chinese (CC BY-SA) prose and the official HSK grammar-point list instead. Word audio: Wikimedia Commons + Lingua Libre cmn (~9k CC BY-SA files with per-file attribution) plus audio-cmn for HSK words; Forvo API confirmed paid (no free tier) — use on-device TTS as the universal free fallback. Every recommended source is keyless bulk-downloadable into SQLite; ship a licenses/attribution screen listing CC-CEDICT, Arphic/makemeahanzi, SUBTLEX-CH citation, Tatoeba per-sentence links, and per-file audio credits.

========== FRENCH ==========

### kaikki.org — Wiktionnaire (French Wiktionary) machine-readable extraction  [RECOMMENDED]
URL: https://kaikki.org/frwiktionary/Fran%C3%A7ais/
WHAT: Full wiktextract extraction of fr.wiktionary.org: 2,030,796 distinct French words (dump 2026-07-06), definitions in French, IPA pronunciations, etymology, and crucially full inflection/conjugation 'forms' arrays (1.68M verb senses) usable to build conjugation tables. Raw JSONL at https://kaikki.org/frwiktionary/rawdata.html (675.9 MB gz / 6.2 GB raw).
LICENSE: Data inherits Wiktionary dual license: CC BY-SA 4.0 + GFDL. Redistribution in free or paid apps allowed; you must attribute Wiktionnaire/Wiktionary (+ courtesy credit to wiktextract/kaikki.org) and keep the derived DATASET (your SQLite word tables) under CC BY-SA — app code itself is not affected.
ACCESS: Bulk download: JSONL (one JSON object per line) from kaikki.org rawdata page; per-word JSON pages also browsable. No key, no rate limit. Underlying XML dumps also at https://dumps.wikimedia.org/frwiktionary/ (verified live, latest 20260701).
NOTES: Verified alive 2026-07-29 (regenerated monthly from fresh dumps). This is the single richest French source: dictionary + IPA (with nasal vowels) + conjugations in one file. Glosses are in French; pair with the English-Wiktionary edition below for English glosses. Some per-POS JSONL convenience files are marked DEPRECATED — prefer the raw wiktextract JSONL.

### kaikki.org — French dictionary from English Wiktionary  [RECOMMENDED]
URL: https://kaikki.org/dictionary/French/
WHAT: French entries extracted from en.wiktionary.org: 388,993 word forms with English-language glosses, IPA, POS, senses (103k noun senses, 283k verb senses). Ideal for FR→EN learner definitions.
LICENSE: CC BY-SA 4.0 + GFDL (Wiktionary content). Same terms as above: attribution + share-alike on the data; commercial app distribution allowed.
ACCESS: Bulk JSONL download (per-language extract from the enwiktionary raw data at https://kaikki.org/dictionary/rawdata.html). Keyless.
NOTES: Verified alive 2026-07-29, last updated 2026-07-25. Use this for English-facing definitions and the frwiktionary edition for depth/conjugations; both share the same schema (wiktextract).

### Lexique 3.83 (New & Pallier)  [RECOMMENDED]
URL: http://www.lexique.org/
WHAT: ~140,000 French words with orthography, phonemic transcription (phon field, ASCII pseudo-X-SAMPA — trivially mappable to IPA; encodes nasal vowels, schwa, semivowels), syllabification, lemma, POS, gender/number, and two frequency measures: film/TV subtitles (freqfilms2) and books (freqlivres). The reference dataset for French frequency + phonology.
LICENSE: CC BY-SA 4.0 — verified in the openlexicon README (openlexicon.fr/datasets-info/Lexique382/README-Lexique.html links LICENSE-CC-BY-SA4.0.txt) and stated on lexique.org. Redistribution in a free or paid app IS allowed with attribution (New & Pallier) and share-alike on the derived dataset.
ACCESS: TSV download: http://www.lexique.org/databases/Lexique383/Lexique383.tsv ; reliable mirror + docs in GitHub repo chrplr/openlexicon (repo-wide CC BY-SA 4.0). Also on OSF.
NOTES: Site alive but has a TLS misconfiguration (cert covers lexique.org, www redirect loops over HTTPS) — use plain http or the GitHub/openlexicon mirror. The phon field is your spelling→pronunciation backbone (silent letters fall out of ortho-vs-phon alignment); combine with wiktextract IPA for true IPA strings.

### hermitdave/FrequencyWords (OpenSubtitles French frequency lists)  [RECOMMENDED]
URL: https://github.com/hermitdave/FrequencyWords
WHAT: Word frequency lists generated from OpenSubtitles 2016 and 2018 corpora; French folder has fr_full.txt, fr_50k.txt, fr_ignored.txt ('word count' per line). Good for ordering vocab by real spoken-register frequency.
LICENSE: Dual: MIT for code, CC BY-SA 4.0 for the list content (stated in repo README). Bundling in a paid app allowed with attribution + share-alike on the lists.
ACCESS: Plain-text bulk download from GitHub raw URLs, e.g. content/2018/fr/fr_50k.txt. Keyless.
NOTES: Verified alive 2026-07-29. Not lemmatized and contains subtitle noise (names, contractions like «c'est» split artifacts) — join against Lexique lemmas for a clean learner list. Largely redundant if you already use Lexique's freqfilms2, but useful as a cross-check.

### Tatoeba French sentence corpus  [RECOMMENDED]
URL: https://tatoeba.org/en/downloads
WHAT: 729,083 French sentences (verified 2026-07-29; 8th largest language), with translation links to English (2.04M) and Mandarin (88.5k) — enables FR↔EN and FR↔ZH example pairs. Weekly CSV/TSV exports: sentences, sentence pairs, links, tags, lists, audio metadata.
LICENSE: Sentences: CC BY 2.0 FR (a subset is CC0 1.0). CC BY allows free/paid app bundling with attribution — Tatoeba asks you to credit sentence authors (username) and link back; store the sentence ID + username columns to satisfy this. Audio is per-contributor: files with an EMPTY license field may NOT be reused outside Tatoeba — filter by license column.
ACCESS: Bulk downloads (per-language filtered exports available) from the downloads page; no key. Also a free JSON API (api.tatoeba.org) if needed.
NOTES: Sentence quality varies (user-generated); prefer sentences with 'OK' review tags or from proofread corpora. The pairs export directly gives FR–EN aligned examples for your SQLite DB.

### Lingua Libre French recordings (via Wikimedia Commons)  [RECOMMENDED]
URL: https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation-fra
WHAT: 430,990 French single-word/phrase pronunciation recordings (verified count 2026-07-29) by native speakers, WAV/OGG, filenames follow 'LL-Q150 (fra)-Speaker-word.wav' so per-word lookup is deterministic. By far the largest open French word-audio set.
LICENSE: CC BY-SA 4.0 (Lingua Libre records everything under CC BY-SA 4.0; each Commons file page states it). App bundling allowed, free or paid, with attribution (speaker + Lingua Libre) and share-alike on the audio files.
ACCESS: Keyless Wikimedia Commons API: query the category or search 'LL-Q150 (fra)-...-<word>.wav' and fetch file URLs; bulk via PetScan + wikiget (~15,000 files/hour, documented at https://commons.wikimedia.org/wiki/Help:Lingua_Libre/Download_datasets/en). Note: the old per-language zip dumps at lingualibre.org/datasets are STALLED (since ~Jan 2022) — use Commons directly.
NOTES: Project is alive but reorganizing: lingualibre.org wiki moved to archive.lingualibre.org and the main site is now a JS app; treat Commons as the canonical store. For sentence audio also consider Mozilla Common Voice French (CC0) if you later need sentence-level speech.

### Shtooka project (shtooka.net)  [skip/low]
URL: https://shtooka.net/
WHAT: Historic free audio collections of French words (~20k+ recordings, mostly CC BY).
LICENSE: Was CC BY per collection — but see notes.
ACCESS: DEAD: verified 2026-07-29 that shtooka.net now 301-redirects to us-stemcell.com (unrelated site — domain lost/parked). Partial mirrors: https://fsi-languages.yojik.eu/oldshtooka/ and some collections on Wikimedia Commons (Commons:Shtooka).
NOTES: Do not build on this. Its successor is effectively Lingua Libre (Wikimédia France took the concept over in 2015), which supersedes it in both size and freshness.

### FLELex (CEFRLex project, UCLouvain)  [skip/low]
URL: https://cental.uclouvain.be/cefrlex/flelex/
WHAT: The only real CEFR-graded French lexicon: ~14k lemmas with frequency distributions across A1–C2, estimated from a 777k-word corpus of FFL textbooks and graded readers. TSV, two variants (FLELex-TT, FLELex-CRF).
LICENSE: CC BY-NC-SA 4.0 — the NC clause is PROBLEMATIC for your use: it forbids commercial use, which app-store distribution (even of a free app, and certainly a paid one) is commonly interpreted to include. Not safe to bundle without written permission from CENTAL.
ACCESS: TSV download at https://cental.uclouvain.be/cefrlex/flelex/download/ — but note the server refused connections (ECONNREFUSED) when tested on 2026-07-29; may be a temporary outage. Online query UI also exists.
NOTES: Practical workaround: don't bundle FLELex; instead derive your own A1→C2 bands from Lexique frequency percentiles (CC BY-SA) calibrated against public CEFR descriptors, or email the authors (Thomas François) — they have granted permissions before. Kelly project is NOT an alternative: it never produced a French list (its 9 languages exclude French) and its lists are CC BY-NC-SA anyway.

### Verbiste (Pierre Sarrazin)  [skip/low]
URL: https://perso.b2b2c.ca/~sarrazip/dev/verbiste.html
WHAT: Classic French conjugation knowledge base: XML files covering 7,000+ verbs with conjugation templates; C++ library + french-conjugator CLI.
LICENSE: GPL-2.0. The XML DATA itself is GPL: converting it into your SQLite schema creates a derivative that must ship under GPL with source offer. GPL inside an iOS App Store app is a known legal conflict (Apple's terms add restrictions — the FSF/VLC precedent), so bundling Verbiste-derived data in your packaged app is risky.
ACCESS: Source tarball from the author's page (verified reachable via Debian/Ubuntu packaging; also mirrored at gvlsywt.cluster051.hosting.ovh.net/dev/verbiste.html). Debian packages 'verbiste'.
NOTES: verbecc (github.com/bretttolbert/verbecc, LGPL-3.0, on PyPI) derives its French templates from Verbiste — same GPL-provenance concern for the data. Prefer generating conjugations from Wiktionnaire 'forms' in the kaikki frwiktionary JSONL (CC BY-SA) instead — coverage is larger and license is app-store-safe.

### hbenbel/French-Dictionary (conjugation + morphology CSVs)  [RECOMMENDED]
URL: https://github.com/hbenbel/French-Dictionary
WHAT: Ready-made CSVs of French adjectives, adverbs, nouns, pronouns, determiners and VERBS with gender, types and full conjugations — generated from the kaikki.org Wiktionary extraction.
LICENSE: Repo says MIT, but the data is derived from Wiktionary, so the honest effective license on the content is CC BY-SA 4.0 (the MIT label cannot strip Wiktionary's terms). Treat as CC BY-SA: attribution to Wiktionary + share-alike on the data — still fine for free/paid apps.
ACCESS: git clone / raw CSV downloads from GitHub. Keyless.
NOTES: Verified alive 2026-07-29. Saves you writing your own wiktextract forms parser; validate a sample against Bescherelle-style tables before shipping. If you want guaranteed-clean provenance, regenerate the same CSVs yourself from kaikki JSONL.

### FreeDict fra-eng / eng-fra  [skip/low]
URL: https://freedict.org/downloads/
WHAT: Bilingual dictionaries: French→English v0.4.1 (8,505 headwords), English→French v0.1.6 (8,799 headwords). TEI XML source; dictd/StarDict/slob builds.
LICENSE: GPL-2.0-or-later (per FreeDict licensing wiki and distro packaging). GPL data = same App Store bundling problem as Verbiste.
ACCESS: Bulk download, keyless; project verified alive (dictionaries dated 2025-11-23).
NOTES: Too small to matter next to kaikki (8.5k vs 389k entries) and license is worse. Skip for the French track.

### Free Dictionary API (freedictionaryapi.com)  [skip/low]
URL: https://freedictionaryapi.com/
WHAT: Keyless JSON dictionary API with French support (ISO code 'fr'), backed by wiktextract/Wiktionary data: definitions, translations, pronunciations.
LICENSE: Served content is CC BY-SA 4.0 (Wiktionary); the site requires attribution to Wiktionary and FreeDictionaryAPI.com. Free, no key, 1,000 requests/hour/IP.
ACCESS: REST JSON API, e.g. /api/v1/entries/fr/{word}. No signup.
NOTES: Verified alive 2026-07-29. Fine as an online fallback for words missing from your bundle, but a third-party free service with no SLA — your local-first design should treat kaikki bulk data as primary. (dictionaryapi.dev, the other well-known free API, is English-only — not usable for French.)

### Project Gutenberg — French collection  [RECOMMENDED]
URL: https://www.gutenberg.org/browse/languages/fr
WHAT: Thousands of public-domain French books (Verne, Dumas, Maupassant, Perrault fairy tales — good graded-ish reading from B1 up), EPUB/HTML/TXT with some audiobooks.
LICENSE: Public domain in the US. The 'Project Gutenberg License' only restricts use of the PG trademark/header — strip the PG boilerplate and the texts themselves are unrestricted, including commercial app bundling. (Check copyright locally for post-1930 authors; 19th-century classics are safe worldwide.)
ACCESS: Bulk-friendly: gutenberg.org mirrors, Gutendex JSON API (gutendex.com, keyless) filterable by language=fr.
NOTES: Verified alive 2026-07-29. True beginner-graded readers are scarce here (these are native-level classics); for A1–A2 reading use Wikibooks lessons and Tatoeba sentences instead.

### Wikibooks French  [RECOMMENDED]
URL: https://en.wikibooks.org/wiki/French
WHAT: Structured French course (75% developed, updated Dec 2024): alphabet, pronunciation (incl. nasal vowels and liaison lessons), beginner→advanced lessons, grammar reference, vocabulary lists, PDF version.
LICENSE: CC BY-SA 4.0 (Wikimedia standard since June 2023). Bundling in free/paid apps allowed with attribution + share-alike on the content.
ACCESS: Scrape/export via keyless MediaWiki API (en.wikibooks.org/w/api.php) or the PDF/print version; XML dumps at dumps.wikimedia.org.
NOTES: Verified alive 2026-07-29. Quality is decent but uneven; best used as the skeleton for your grammar track, rewritten in your own words (which also frees you from SA on the prose).

### Tex's French Grammar (COERLL, UT Austin)  [RECOMMENDED]
URL: https://www.laits.utexas.edu/tex/
WHAT: Complete pedagogical French reference grammar: themed chapters (nouns, verbs, pronouns...), self-correcting exercises, recorded dialogues with audio, verb tutor. A genuinely good beginner grammar narrative.
LICENSE: CC BY (Attribution) — confirmed on COERLL's OER page (coerll.utexas.edu/coerll/oer/texs-french-grammar/). CC BY is the friendliest possible: bundle in free or paid apps, just credit COERLL/UT Austin; no share-alike.
ACCESS: Old site live and redirecting readers to the new Pressbooks edition (utexas.pressbooks.pub — returned 403 to automated fetch but is publicly accessible in browsers); content scrapable, and Pressbooks offers export formats.
NOTES: Verified 2026-07-29. Because it's CC BY (not SA), this is the BEST grammar text to bundle verbatim — better license than Wikibooks. Audio included.

### GLAWI / GLÀFF (REDAC, Université de Toulouse)  [skip/low]
URL: http://redac.univ-tlse2.fr/lexicons/glaff_en.html
WHAT: GLAWI: 1.34M-article XML machine-readable dictionary built from Wiktionnaire; GLÀFF: large inflectional + phonological lexicon (IPA transcriptions, inflection paradigms) derived from it — an alternative spelling→IPA source.
LICENSE: Free license inherited from Wiktionnaire (CC BY-SA 3.0 per its papers).
ACCESS: Download from redac.univ-tlse2.fr — but the host refused HTTPS connections when tested 2026-07-29 (legacy HTTP-only server); access is shaky.
NOTES: Frozen academic snapshots (2015-2016 era) and awkward hosting; kaikki.org's live frwiktionary extraction supersedes it for your purposes. Listed only so you don't chase it.

--- SUMMARY (french): Backbone: use kaikki.org's two Wiktionary extractions (frwiktionary for depth + conjugation 'forms' + IPA; English-Wiktionary French edition for English glosses) as the dictionary and conjugation source — CC BY-SA 4.0, bulk JSONL, keyless, verified fresh (July 2026 dumps). Add Lexique 3.83 (CC BY-SA 4.0, confirmed — commercial redistribution OK with attribution) for the frequency (film subtitles + books) and phonology layer; its ortho-vs-phon alignment plus wiktextract IPA covers nasal vowels and silent letters, and liaison rules come from Tex's French Grammar (CC BY — the best-licensed grammar text, bundle it verbatim) and Wikibooks French (CC BY-SA). Examples: Tatoeba's 729k French sentences (CC BY 2.0 FR — store sentence ID + username for attribution) with FR-EN pair exports; classic reading from Project Gutenberg (public domain). Audio: Lingua Libre via Wikimedia Commons — 430,990 French word recordings, CC BY-SA 4.0, deterministic 'LL-Q150 (fra)-Speaker-word' filenames, keyless Commons API (official zip dumps are stalled; Shtooka is dead — domain now points to an unrelated site). CEFR grading is the one gap: FLELex is CC BY-NC-SA (NC — do not bundle; site was also unreachable when tested) and the Kelly project never made a French list, so derive A1–C2 bands from Lexique frequency percentiles yourself or request permission from CENTAL. Avoid GPL data (Verbiste, FreeDict fra-eng) in the app-store build — conjugations from kaikki/Wiktionnaire (or hbenbel's MIT-labeled but effectively CC BY-SA CSVs) replace Verbiste cleanly. Everything recommended is $0, bulk-downloadable, and app-bundle-safe under attribution + share-alike on the data only (your app code stays closed).

========== WRITING-SYSTEMS ==========

### hanzi-writer (JS library)  [RECOMMENDED]
URL: https://github.com/chanind/hanzi-writer
WHAT: Chinese character stroke-order animation + interactive tracing quiz engine. API verified at hanziwriter.org/docs.html: animateCharacter()/animateStroke(n), quiz() with onCorrectStroke/onMistake/onComplete callbacks, hint after N mistakes, configurable speed/delayBetweenStrokes, charDataLoader hook for fully offline/local data. Works with simplified and traditional.
LICENSE: MIT (library code). Free app and paid app-store bundling both fine; keep the MIT notice.
ACCESS: npm package `hanzi-writer`; data loaded via charDataLoader from bundled JSON (no network needed) or jsDelivr CDN by default.
NOTES: Verified alive 2026-07-29. The de-facto standard; exactly matches the 'show stroke order, then make the user trace it' teaching flow. The quiz engine can in principle be reused for any script if you supply data in its format (strokes = SVG outline paths, medians = point arrays).

### hanzi-writer-data (stroke data, derived from Make Me a Hanzi)  [RECOMMENDED]
URL: https://github.com/chanind/hanzi-writer-data
WHAT: Per-character JSON for ~9,500 characters (npm v2.0.1, 9,585 files, ~32 MB unpacked; one small JSON per char so you can bundle only what you teach, or all of it in SQLite). Format: `strokes` = SVG path strings of stroke outlines, `medians` = arrays of [x,y] points down each stroke (used for tracing match). Derived from skishore/makemeahanzi, which vectorized Arphic Technology fonts.
LICENSE: Arphic Public License (verified full text at raw.githubusercontent.com/chanind/hanzi-writer-data/master/ARPHICPL.TXT). Redistribution and commercial use explicitly allowed ('copy and distribute... without restriction'; redistributors may even charge). Conditions: ship ARPHICPL.TXT unaltered with the data; if you MODIFY the data itself, the modified data must remain freely available under APL. Copyleft covers only the font data, not your app ('separate and independent works... mere aggregation' clause) — bundling inside an app-store app is permitted.
ACCESS: npm `hanzi-writer-data` (per-char JSON + all.json); also raw GitHub. Keyless, bulk.
NOTES: Verified alive; npm license field literally 'ARPHICPL'. Practical compliance: include ARPHICPL.TXT + credit 'Make Me a Hanzi / Arphic Technology' in your app's licenses screen. If you convert JSON into SQLite rows unmodified that is format repackaging of unmodified data — keep the license file alongside.

### Relief SingleLine (single-line OFL font, best Latin stroke-path source)  [RECOMMENDED]
URL: https://github.com/isdat-type/Relief-SingleLine
WHAT: True single-line/open-path sans font from the French design school isdaT (Toulouse). Formats: SVG font (Inkscape/Hershey-Text style), OTF-SVG, TTF, UFO sources. Being French-made, it includes French Latin coverage (é è ê ç à ù etc. — confirm œ in the character-map PDF in /documentation). Each glyph is one or more open strokes = ready-made 'median' paths for letter-drawing animation and tracing.
LICENSE: SIL Open Font License 1.1 (stated in README). Redistribution + commercial bundling allowed; keep OFL notice; can't sell the font by itself; derived fonts must stay OFL.
ACCESS: Bulk download from GitHub releases; extract per-glyph SVG path `d` attributes (from the SVG font XML) into your SQLite, then animate with stroke-dasharray or feed a hanzi-writer-format record (path as both stroke and median).
NOTES: Verified alive. IMPORTANT finding: no open dataset of pedagogical children's letter-formation stroke order (KanjiVG-for-Latin) exists — I searched GitHub topics, Commons, handwriting projects; everything pedagogical (LetterSchool, Cursive Workshop, worksheet sites) is proprietary. Best free path: take single-line glyph paths from this font and hand-adjust stroke order/direction for the ~62 glyphs you teach (a-z, A-Z, é è ê ë ç à ù û ô î ï œ) — a one-time few-hours job, and the result is your own OFL-derived data.

### Hershey + EMS single-line SVG fonts (oskay/svg-fonts)  [skip/low]
URL: https://gitlab.com/oskay/svg-fonts
WHAT: ~30+ single-stroke SVG 1.1 fonts: classic Hershey engraving fonts (Dr. A. V. Hershey, 1960s NBS) plus modern 'EMS' handwriting-style fonts. Alternative/backup source of Latin stroke paths; some scripts include accented Latin (coverage varies per font — check each).
LICENSE: EMS fonts: SIL OFL 1.1. Classic Hershey data: permissive legacy license — free use incl. commercial, requires acknowledgement of A. V. Hershey and James Hurt, forbids redistribution in the obsolete US NTIS format only. Both fine for app bundling with attribution.
ACCESS: git clone from GitLab (repo verified alive; the old github.com/evil-mad/svg-fonts URL is dead/404 — moved to GitLab). SVG font XML → per-glyph path data.
NOTES: Hershey glyph stroke order is engraving-optimized, not handwriting-pedagogical; EMS script fonts are closer to natural letter formation. Use if Relief SingleLine lacks a glyph you need.

### Vara.js (handwriting text animation library)  [skip/low]
URL: https://github.com/akzhy/Vara
WHAT: MIT JS library that animates handwritten text from its own JSON font format (SVG path data per glyph). Ships a few fonts (derived from OFL script fonts like Satisfy/Pacifico family).
LICENSE: MIT (library); bundled JSON fonts derive from OFL fonts.
ACCESS: npm `vara` / GitHub; JSON font files in repo.
NOTES: Verified alive but semi-dormant (v2 'coming soon' note is years old). Good for decorative 'watch the word being written' flourishes; NOT stroke-order pedagogy and no tracing/quiz mode — you'd still use the hanzi-writer-style approach for actual letter teaching. Its JSON font format is a useful design reference for your own Latin letter data schema.

### Wikimedia Commons animated Latin letter GIFs  [skip/low]
URL: https://commons.wikimedia.org/wiki/Category:Animated_upper_case_Latin_letters_on_font_lines_(image_set)
WHAT: 29 GIFs (300x300) animating uppercase A–Z + Ä Ö Ü being written on guide lines.
LICENSE: Per-file (Commons requires free licenses — CC BY-SA or similar); check each file page.
ACCESS: Direct download from Commons.
NOTES: Verified alive but weak: uppercase only (no complete lowercase set exists — I checked), German umlauts not French accents, raster GIF (no interactivity/tracing), inconsistent per-file licensing. Listed for completeness; the single-line-font approach is better.

### Wikimedia Commons IPA phone recordings (used via Wikipedia's 'IPA chart with audio' pages)  [RECOMMENDED]
URL: https://en.wikipedia.org/wiki/IPA_vowel_chart_with_audio
WHAT: One audio file per official IPA phone (vowels + pulmonic/non-pulmonic consonants), .ogg/.wav, recorded mainly by Peter Isotalo, Denelson83, UCLA Phonetics Lab Archive, Halibutt, Pmx, Octane. Effectively complete for the official IPA chart — covers everything you need for EN/FR/ZH phoneme intros (θ ð, ʁ, nasal vowels ɑ̃ ɔ̃ ɛ̃, ʂ ʐ ɻ, y, etc.). The companion page en.wikipedia.org/wiki/IPA_pulmonic_consonant_chart_with_audio indexes the consonants.
LICENSE: Spot-checked File:Bilabial_nasal.ogg — dual CC BY-SA 3.0 / GFDL 1.2+; commercial redistribution allowed with attribution + license link. Licenses vary per file (some PD) — record author+license per file when you download.
ACCESS: Bulk-download via Commons API (keyless): the chart pages link every file; also Commons Category:International Phonetic Alphabet. Store as blobs in SQLite with an attribution column.
NOTES: Verified alive. CC BY-SA on audio assets bundled in an app = fine (attribution screen; ShareAlike binds only the audio, not your app, when kept as discrete assets). Do NOT use jbdowse.com/ipa audio instead — verified it is © Jonathan Dowse, all rights reserved, not redistributable.

### IPAtope (open-source interactive IPA table)  [RECOMMENDED]
URL: https://github.com/IPAtope/ipatope.github.io
WHAT: Interactive, filterable IPA table (voicing/place/manner filters, sounds, educational features); 200+ commits.
LICENSE: MIT (code). Audio files' provenance not stated in README — verify before reusing them (likely the same Wikimedia set; safest is to swap in your own Wikimedia downloads with recorded attribution).
ACCESS: GitHub clone; static site, easy to adapt into a PWA view.
NOTES: Verified alive. Good UI starting point to adapt. ipachart.com (verified) is another reference implementation confirming the Wikimedia audio approach, but it is not open source; jacksonvanv/IPAchart exists but has no clear license.

### mp3-chinese-pinyin-sound (full pinyin syllable audio)  [RECOMMENDED]
URL: https://github.com/davinfifield/mp3-chinese-pinyin-sound
WHAT: ~30 MB of MP3s covering Mandarin pinyin syllables in each tone (files named like ma1.mp3) — the classic free pinyin-chart audio bank.
LICENSE: Unlicense (public domain) — verified via GitHub API (spdx: Unlicense). No attribution required; app-store bundling unrestricted.
ACCESS: git clone / GitHub zip download; drop straight into SQLite or assets.
NOTES: Verified alive; dormant since 2014 (fine for static audio). Gotcha: original recording provenance is undocumented, so the Unlicense claim rests on the uploader; used widely (e.g., plain-pinyin) without issue. Cross-check coverage against a valid-syllable table; fall back to audio-cmn for missing items.

### audio-cmn (syllables + HSK word audio)  [RECOMMENDED]
URL: https://github.com/hugolpz/audio-cmn
WHAT: ~10,300 MP3s: 1,707 pinyin syllables (speaker Chen Wang) + 8,596 HSK words (speaker Yue Tan, from the SWAC project), each in 4 bitrates (18k–96k) — doubles as vocab audio for your Chinese modules beyond the alphabet chapter.
LICENSE: CC BY-SA (verified in README). Commercial redistribution OK; must credit the named speakers/project; ShareAlike applies to the audio files themselves.
ACCESS: GitHub bulk download; keyless.
NOTES: Verified alive. Cleaner provenance than davinfifield (named speakers). Use the 24k or 64k files for app size.

### plain-pinyin (open-source interactive pinyin chart with quiz)  [RECOMMENDED]
URL: https://github.com/digglesby/plain-pinyin
WHAT: Next.js/TypeScript interactive pinyin chart with a quiz feature; uses the davinfifield MP3 set for audio; also implicitly encodes the valid initial×final syllable matrix you need to build a chart.
LICENSE: MIT (code); bundled audio is Unlicense (from davinfifield).
ACCESS: GitHub clone.
NOTES: Verified alive. Best open reference implementation for your pinyin-chart screen; license chain fully clean for bundling.

### CMU Pronouncing Dictionary (cmudict)  [RECOMMENDED]
URL: https://github.com/cmusphinx/cmudict
WHAT: 134k+ North American English words → ARPAbet phonemes with stress. The standard raw material for programmatically generating phonics examples and MINIMAL PAIRS (pair words whose phoneme strings differ in exactly one segment: ship/sheep, thin/tin, light/right).
LICENSE: BSD-style 'use for any research or commercial purpose is completely unrestricted' (verified README); retain copyright notice, acknowledgement requested.
ACCESS: Plain-text bulk file cmudict.dict in repo; trivially importable to SQLite; keyless.
NOTES: Verified alive. Note for phonics scope-and-sequence content: Core Knowledge CKLA is CC BY-NC-SA (verified 'no one is permitted to sell' — NC, problematic long-term, use only as inspiration); the OSF 'Open Dataset of Grapheme-Phoneme Correspondences in American English' (osf.io/xvyjn) has NO license attached (verified via OSF API) — do not bundle. So generate your own GPC tables from cmudict + ipa-dict instead.

### ipa-dict (word → IPA for en_US, en_UK, fr_FR, fr_QC, zh Hans/Hant)  [RECOMMENDED]
URL: https://github.com/open-dict-data/ipa-dict
WHAT: Wordlists with IPA transcriptions for 28+ languages — crucially ALL THREE of your languages (English US/UK, French France/Québec, Mandarin in simplified and traditional orthography). Formats: TSV txt, JSON, CSV, XML in GitHub releases. Powers letter→sound tables, French liaison/accent pronunciation lookups, and minimal-pair mining in one consistent IPA notation.
LICENSE: MIT (verified README; a few third-party source dicts keep their own licenses — check the per-language credits table for the ones you ship).
ACCESS: Bulk download from GitHub releases; keyless; SQLite-friendly.
NOTES: Verified alive (787 stars). Best single cross-language pronunciation dataset for your app. Supplement: CUNY-CL/wikipron (Apache-2.0 tool, 5M+ pronunciations scraped from Wiktionary; that data is CC BY-SA 3.0/GFDL) if you need more coverage.

### phonetics-teaching-assets (CC0 sagittal articulation diagrams)  [RECOMMENDED]
URL: https://github.com/drammock/phonetics-teaching-assets
WHAT: 51 vocal-tract SVGs (by Richard Wright & Dan McCloy, Univ. of Washington): midsagittal consonant diagrams incl. θ and ð (English th), ʁ and χ (French R), retroflex ɻ (Mandarin r), full nasal series, plus vowels, glottis states, airstream mechanisms. Verified file list via GitHub API. Same images are on Commons as 'IPA x Sagittal Section.svg'.
LICENSE: CC0 1.0 public domain (verified on repo and on the Commons file pages). Zero obligations — ideal for app bundling.
ACCESS: GitHub bulk clone (SVG + WMF).
NOTES: Verified alive. Gap: no retroflex sibilants ʂ/ʐ (Mandarin zh/ch/sh) — approximate with the apical ʃ/ʒ variants or adapt one SVG (CC0 allows it). Complement with Commons Category:Articulation place diagrams (102 files, mixed free licenses) and the real-time MRI speech video File:Real-time MRI - Speaking (English).ogv (verified CC BY-SA 3.0, Max Planck Inst.) for 'see the whole tract move' content. French nasal vowels: show lowered-velum nasal diagrams + Commons audio ɑ̃/ɔ̃/ɛ̃.

### Seeing Speech / SpeechSTAR (Univ. of Glasgow MRI & ultrasound IPA clips)  [skip/low]
URL: https://www.seeingspeech.ac.uk/
WHAT: Beautiful IPA charts linked to MRI/ultrasound/animation videos of every IPA sound — pedagogically the best articulation videos online.
LICENSE: NOT open: materials are 'unadapted form only, non-commercial purposes only' (CC BY-NC-ND-style terms, verified via their pages). NC + ND — flagged as PROBLEMATIC per your criteria.
ACCESS: Website only.
NOTES: Verified alive. Do NOT scrape or bundle. At most, link out to it from the app (external links are fine). Use the CC0 sagittal SVGs + CC BY-SA Wikimedia MRI video for bundled content instead.

--- SUMMARY (writing-systems): Recommended stack for the alphabet/writing-system module, all verified alive on 2026-07-29 with license text checked. CHINESE: hanzi-writer (MIT) + hanzi-writer-data (~9.5k chars, Arphic Public License — redistribution and app bundling explicitly permitted; ship ARPHICPL.TXT and credit Make Me a Hanzi/Arphic) gives you stroke animation AND tracing quizzes offline; pinyin chart = plain-pinyin (MIT) as UI reference + davinfifield MP3s (Unlicense, provenance undocumented) with audio-cmn (CC BY-SA, named speakers, also 8.6k HSK words) as the cleaner/backup audio. LATIN (EN/FR): key negative finding — no pedagogical open letter-formation dataset (no 'KanjiVG for Latin') exists; the free path is to extract per-glyph open-path strokes from an OFL single-line font (Relief SingleLine, French-made so accents are covered; Hershey/EMS fonts at gitlab.com/oskay/svg-fonts as fallback), hand-order ~62 glyphs once, and reuse the hanzi-writer data format so one animation/tracing engine serves both scripts. PRONUNCIATION: Wikimedia Commons IPA recordings (mostly CC BY-SA 3.0/GFDL, complete for the IPA chart — the same set ipachart.com uses; jbdowse.com audio is copyrighted, avoid) + IPAtope (MIT) as chart UI; word→IPA for all three languages from ipa-dict (MIT); English phonics/minimal pairs generated from cmudict (unrestricted BSD-style) since ready-made phonics OER is CC BY-NC (Core Knowledge) or unlicensed (OSF GPC dataset). ARTICULATION VISUALS: drammock/phonetics-teaching-assets CC0 sagittal SVGs (covers English th, French R, Mandarin r; gap: ʂ/ʐ) + CC BY-SA Commons MRI video; Seeing Speech is NC/ND — link out only, never bundle. Net attribution burden: one in-app licenses screen (Arphic, OFL, CC BY-SA credits); everything recommended is keyless bulk download suitable for SQLite bundling in free or paid app-store builds.

========== LEARNING-SCIENCE ==========

### ts-fsrs (npm, open-spaced-repetition)  [RECOMMENDED]
URL: https://github.com/open-spaced-repetition/ts-fsrs
WHAT: TypeScript implementation of the FSRS-6 spaced-repetition algorithm (21-parameter model). Current version 5.4.1 (verified via npm registry). ESM/CJS/UMD builds, Node >=20. API: fsrs(generatorParameters?) creates a scheduler; createEmptyCard() makes a card; scheduler.repeat(card, now) previews all 4 rating outcomes; scheduler.next(card, now, Rating.Good|Again|Hard|Easy) applies one. Card state (due, stability, difficulty, reps, lapses, state) is a plain object that maps cleanly onto SQLite columns.
LICENSE: MIT — verified on GitHub. Bundling inside a free or paid app-store app is fully allowed; only requirement is keeping the copyright/license notice.
ACCESS: npm package `ts-fsrs` (keyless, offline after install); source on GitHub.
NOTES: Actively maintained in 2025-2026 (~730 stars, 282 commits, release CI running). Lives in the healthy open-spaced-repetition org whose FSRS is Anki's default since v23.10; benchmarks on 500M+ Anki reviews show FSRS needs ~20-30% fewer reviews than SM-2 for equal retention. STRONG recommendation over hand-writing SM-2: SM-2 is ~50 lines but obsolete; ts-fsrs gives you battle-tested scheduling, retrievability math, and parameter-optimization compatibility for free. Background reading: https://github.com/open-spaced-repetition/fsrs4anki/wiki/abc-of-fsrs

### Anki Manual — Deck Options (review-load math reference)  [RECOMMENDED]
URL: https://docs.ankiweb.net/deck-options.html
WHAT: Official documentation of daily new/review limits. Key design number: Anki recommends the review limit be at least 10x the new-card limit; community steady-state data shows daily reviews settle at roughly 8-12x daily new intake while a deck is young, drifting lower as intervals lengthen. Each new card generates ~4-6 reviews in its first 30 days.
LICENSE: Freely readable documentation (Anki is AGPL software). Link/cite, don't bundle text.
ACCESS: Web page, no key.
NOTES: Use for the app's load simulator: N new/day per language implies ~8-12N reviews/day at steady state. Example: 10 new/day x 3 languages = 30 new/day -> expect 250-350 total reviews/day (~30-45 min at 6-8 s/card). This is why 5-10 new words per language per day is the sustainable envelope for a 3-language learner. Supporting community analysis: https://cademcniven.com/posts/20211119/

### Dunlosky et al. 2013 — Improving Students' Learning With Effective Learning Techniques (PSPI)  [RECOMMENDED]
URL: https://www.psychologicalscience.org/publications/journals/pspi/learning-techniques.html
WHAT: The standard evidence review ranking 10 study techniques: practice testing (retrieval) and distributed practice rated HIGH utility; rereading/highlighting low. The scientific backbone for an SRS-first app design and for daily-tip content.
LICENSE: Copyrighted paper, but full text is legally free via the publisher's page above and mirrored author PDFs (e.g. https://www.whz.de/fileadmin/lehre/hochschuldidaktik/docs/dunloskiimprovingstudentlearning.pdf). Cite/link; do not bundle the PDF.
ACCESS: Free PDF/HTML, no key.
NOTES: Verified alive. Ideal citation for in-app explanations of why the app schedules reviews instead of rereading.

### Interleaving research — Taylor & Rohrer 2010 + Kang 2016  [RECOMMENDED]
URL: http://uweb.cas.usf.edu/~drohrer/pdfs/Taylor&Rohrer2010ACP.pdf
WHAT: Free author PDFs: interleaved practice hurts in-session performance but roughly doubled-to-tripled next-day test scores (63% vs 20% in Rohrer & Taylor's geometry study); Kang 2016 (Policy Insights, https://journals.sagepub.com/doi/abs/10.1177/2372732215624708) reviews spacing evidence. Basis for the 3-languages-per-day question.
LICENSE: Copyrighted; author-hosted PDF is free to read. Link/cite only.
ACCESS: Direct PDF, no key.
NOTES: Honest synthesis for the app: there is NO direct RCT on studying 3 languages in one day. Spacing research strongly favors daily contact with each language (and FSRS effectively requires it — skipped days pile up reviews). Interleaving evidence is about mixing categories within one skill, not mixing languages mid-session. Practical, defensible design: all 3 languages every day, in separate blocks (e.g. 20-25 min each), rotating block order; avoid word-by-word mixing of French and English (similar languages interfere most); Mandarin's distinctness makes it a good buffer block.

### Nation 2006 — How Large a Vocabulary Is Needed for Reading and Listening?  [RECOMMENDED]
URL: https://www.lextutor.ca/cover/papers/nation_2006.pdf
WHAT: Canonical vocabulary-size targets: 8,000-9,000 word families for comfortable reading of authentic text, 6,000-7,000 for listening, ~3,000 for 95% coverage of informal speech. Turns 'new words per day' into concrete multi-year milestones (10/day = 3,650/yr).
LICENSE: Copyrighted, free author-archived PDF (Paul Nation also freely shares BNC/COCA word lists at https://www.wgtn.ac.nz/lals/resources/paul-nations-resources). Link/cite; word lists page states free availability for research/teaching — check the list README before bundling.
ACCESS: Free PDF; word-frequency lists as downloadable files.
NOTES: Verified alive. Pairs with the sustainable-rate evidence: community consensus (and burnout math) says 10-20 new cards/day per language, 5-10 if running three languages.

### Atkinson & Raugh 1975 — keyword method (ERIC free copy)  [RECOMMENDED]
URL: https://eric.ed.gov/?id=ED096816
WHAT: Original Stanford studies of the keyword mnemonic for foreign vocabulary: keyword group scored 88% vs 28% control (Spanish); 72% vs 46% (Russian, 120 words over 3 days). The authoritative citation for the app's mnemonic-tip feature.
LICENSE: ERIC technical-report copy is free to download; US-funded technical report, effectively freely reproducible with citation. The 1975 journal version (https://eric.ed.gov/?id=EJ118388) is abstract-only.
ACCESS: Free PDF from ERIC, no key.
NOTES: Verified alive. Works for all three target languages; for Mandarin combine with tone mnemonics, for French with gender-ending rules.

### William Walker Atkinson — Memory: How to Develop, Train, and Use It (Project Gutenberg #41478)  [RECOMMENDED]
URL: https://www.gutenberg.org/ebooks/41478
WHAT: Full public-domain memory-training book (association, attention, review habits). A legal source of BUNDLEABLE daily-tip text — you can ship excerpts inside the app verbatim.
LICENSE: Public domain in the USA (verified on Gutenberg). No attribution legally required; Project Gutenberg trademark rules only apply if you keep their header. Safe to embed in a paid app.
ACCESS: Bulk download: EPUB/HTML/plain text.
NOTES: Verified alive. Also public domain and bundleable: Ebbinghaus 1885/1913 'Memory' (forgetting curve — the origin story of spaced repetition) at https://en.wikisource.org/wiki/Memory:_A_Contribution_to_Experimental_Psychology and https://psychclassics.yorku.ca/Ebbinghaus/index.htm. Modernize the prose; 1910s advice needs curation.

### Hacking Chinese (Olle Linge) — tones, tone-colour, and mnemonics guides  [RECOMMENDED]
URL: https://www.hackingchinese.com/the-hacking-chinese-guide-to-mandarin-tones/
WHAT: Best free treatment of tone learning and tone-colour association: 'Does using colour to represent Mandarin tones make them easier to learn?' (https://www.hackingchinese.com/does-using-colour-to-represent-mandarin-tones-make-them-easier-to-learn/), mnemonics guides, plus continuously updated 'best YouTube channels/podcasts for Chinese' lists (2026 editions verified).
LICENSE: Copyrighted blog — LINK ONLY, do not bundle text. Linking is free and he actively maintains resource lists you can point to.
ACCESS: Web, no key.
NOTES: Verified active in 2026. Tone-colour scheme to implement in-app (colors are an idea, not copyrightable): a common convention is T1 red/flat, T2 yellow/rising, T3 green/low, T4 blue/falling — Pleco-style color coding. Linge's advice: use tone mnemonics selectively for stubborn words, not for everything.

### French gender-by-ending rule (Lyster 2006, via free explainers)  [RECOMMENDED]
URL: https://copycatcafe.com/blog/french-nouns-gender
WHAT: Roy Lyster (McGill, 2006 corpus study): ~80% of French nouns' gender is predictable from the ending (81% feminine, 80% masculine rule-governed). Free explainers list the reliable endings (masc: -age, -ment, -eau, -isme, -ier, -oir; fem: -tion, -té, -ie, -ée, -ence, -ure, -ette...) and top exception sets (feminine cage/page/plage/rage/nage/image; masculine musée/lycée/trophée).
LICENSE: Lyster's paper itself is paywalled (cite it); the ending RULES are facts and freely implementable in your app. Explainer blogs (Copycat Cafe, Kwiziq https://french.kwiziq.com/revision/grammar/how-to-identify-gender-by-some-word-endings) are link-only.
ACCESS: Web, no key; implement the rules as code/data yourself.
NOTES: Perfect daily-tip and card-generation feature: color-code noun cards by predicted gender and flag exceptions. Verified pages alive.

### BBC Learning English  [RECOMMENDED]
URL: https://www.bbc.co.uk/learningenglish
WHAT: Free structured English courses and weekly series (6 Minute English, Real Easy English, The Listening Room), YouTube channel and podcasts, beginner to advanced.
LICENSE: Copyrighted (BBC). LINK ONLY — do not bundle audio/text. Linking legal and free.
ACCESS: Website, YouTube, podcast apps; no account needed.
NOTES: Verified active in 2026 (new weekly output, new Open University partnership course). Top-tier quality; ideal anchor of the English resource list.

### VOA Learning English  [RECOMMENDED]
URL: https://learningenglish.voanews.com/
WHAT: Graded American-English news, podcasts and lesson series at three levels; slow-speed audio ideal for beginners.
LICENSE: Original VOA content is a US-government work — PUBLIC DOMAIN — so unlike almost every other resource you could even bundle article text/audio (verify per-item; agency-acquired photos/music are excluded; see https://www.usagm.gov/work-with-us/content-requests/voa/).
ACCESS: Website + RSS/podcasts, no key.
NOTES: Verified still publishing (site updating as of July 2026) BUT flag: 2025-26 USAGM cuts gutted VOA staff (Poynter, 2026); output is reduced and long-term future uncertain. The existing archive is huge and public domain — worth mirroring the pieces you want early.

### Luke's English Podcast  [RECOMMENDED]
URL: https://teacherluke.co.uk/
WHAT: 1,000+ free episodes of natural British English with discussion of vocabulary; strong intermediate-to-advanced listening ladder.
LICENSE: Copyrighted; free episodes are free to stream/link (premium tier exists — link only to free feed).
ACCESS: Podcast RSS/Spotify/Apple, website with episode archive.
NOTES: Verified active (episode 1005, June 2026). Good bridge from BBC/VOA graded content to authentic listening.

### Elight Learning English (Vietnamese-language instruction)  [RECOMMENDED]
URL: https://www.youtube.com/@ElightLearningEnglish
WHAT: Largest Vietnamese YouTube channel teaching English TO Vietnamese speakers (grammar, pronunciation contrasts VN-EN, mất gốc/beginner series). Fills the 'explained in Vietnamese' niche BBC/VOA can't.
LICENSE: Copyrighted; LINK ONLY.
ACCESS: YouTube; companion site elight.edu.vn (freemium — link only to free content).
NOTES: Verified active with regularly updated lessons per 2026 Vietnamese roundups (english.qts.edu.vn). Pronunciation videos targeting Vietnamese-specific errors (final consonants, /θ/, word stress) are the highlight.

### Mandarin Corner  [RECOMMENDED]
URL: https://www.youtube.com/@MandarinCorner2
WHAT: HSK-organized vocabulary videos, slow real-street interviews and conversation series with pinyin+hanzi+EN subtitles; free full transcripts on mandarincorner.org.
LICENSE: Copyrighted; LINK ONLY.
ACCESS: YouTube + website, no key.
NOTES: Verified active (upload Dec 2025; 267k subs, 325 videos). One of the best free HSK-path listening resources.

### Everyday Chinese + Grace Mandarin Chinese (YouTube)  [RECOMMENDED]
URL: https://www.youtube.com/c/EverydayChinese
WHAT: Everyday Chinese: structured HSK1-4 beginner playlists, daily-life dialogues. Grace Mandarin Chinese (https://www.youtube.com/@GraceMandarinChinese, 350k subs): pronunciation/tones deep-dives by a trained CSL teacher.
LICENSE: Copyrighted; LINK ONLY.
ACCESS: YouTube, no key.
NOTES: Both verified active and listed in multiple 2026 roundups (Hacking Chinese 2026 list: https://www.hackingchinese.com/the-best-youtube-channels-for-learning-chinese/). Grace is the best free tones/pronunciation explainer for beginners.

### TeaTime Chinese 茶歇中文 podcast  [RECOMMENDED]
URL: https://teatimechinese.com/
WHAT: Slow, clear comprehensible-input podcast (beginner-intermediate), 100+ episodes with free transcripts on the site; ideal HSK2-4 listening bridge.
LICENSE: Copyrighted; LINK ONLY.
ACCESS: Site, Spotify, Apple Podcasts, YouTube; no key.
NOTES: Verified active (new episodes June 2026).

### Chinese Grammar Wiki (AllSet Learning)  [RECOMMENDED]
URL: https://resources.allsetlearning.com/chinese/grammar/Main_Page
WHAT: The reference for Mandarin grammar: thousands of grammar points organized by CEFR-ish difficulty level (A1-C1) with examples — the natural 'grammar' link target for every Mandarin lesson in your app.
LICENSE: CC BY-NC-SA 3.0 — verified via its Copyrights page. FLAG: NonCommercial means you CANNOT bundle its text in any app that earns anything (even ads). Linking to specific grammar-point pages is fine and is the intended use.
ACCESS: Web (MediaWiki), no key. An unofficial GitHub mirror exists (ivankra/asg) but inherits the same NC license.
NOTES: Site alive (direct fetch was bot-blocked, existence and license confirmed via search + mirror). Deep-link, never copy.

### HSK Academy  [skip/low]
URL: https://hsk.academy/en
WHAT: Free HSK 1-6 vocabulary lists with audio, character details, practice tests.
LICENSE: No explicit open license — treat word-list pages as LINK ONLY. (Note: HSK word LISTS themselves are official Chinese-government standard data; the raw word/level pairing is factual data you can reconstruct from the official standard rather than scraping this site.)
ACCESS: Web, no key.
NOTES: Alive but copyright notice stops at 2022 and it still reflects HSK 2.0 (6 levels), not the 9-level HSK 3.0. Useful as a learner-facing link; for your database, source HSK 3.0 lists from the official standard (GF0025-2021) or community CSV dumps (e.g. github.com/krmanik or elkmovie repos — check each repo's license).

### Le français facile avec RFI  [RECOMMENDED]
URL: https://francaisfacile.rfi.fr/
WHAT: RFI's learning platform: daily 'Journal en français facile' (slow news with transcript), plus graded exercises A1-B2 tied to real broadcasts; weekly new exercise sets.
LICENSE: Copyrighted (France Médias Monde); free to use, LINK ONLY.
ACCESS: Website + podcast feeds, no account.
NOTES: Verified active (episodes and exercises through July 2026; direct fetch bot-blocked but activity confirmed via podcast directories). The single best free French listening pipeline A2→B2.

### Apprendre le français avec TV5MONDE  [RECOMMENDED]
URL: https://apprendre.tv5monde.com/
WHAT: 2,000+ (4,000 via app) free interactive exercises built on authentic TV clips, organized A1→B2/C1; progress tracking; exercises authored by Alliance Française teachers.
LICENSE: Copyrighted; free with optional account; LINK ONLY.
ACCESS: Website + free EDU app.
NOTES: Verified free and active in 2026. Pair with RFI: TV5Monde for structured exercises, RFI for daily listening.

### InnerFrench (podcast + YouTube)  [RECOMMENDED]
URL: https://innerfrench.com/podcast/
WHAT: Intermediate (B1+) comprehensible-input podcast, 208 episodes with free full transcripts; the standard 'graduate from beginner courses' French resource.
LICENSE: Copyrighted; free episodes/transcripts, paid courses exist — LINK ONLY.
ACCESS: Site, Spotify, Apple; no key.
NOTES: Verified active (episode #196, May 2026, ~2 episodes/month).

### Lawless French + Français Authentique + Easy French  [RECOMMENDED]
URL: https://www.lawlessfrench.com/
WHAT: Lawless French: thousands of free grammar/vocab lesson pages A1-C1 (as of July 2026 fully free, donation-supported). Français Authentique (https://www.francaisauthentique.com/): free podcast for natural spoken French. Easy French (YouTube): street interviews with dual subtitles.
LICENSE: All copyrighted; LINK ONLY.
ACCESS: Web/YouTube/podcast, no keys.
NOTES: All three confirmed in multiple 2026 roundups as active and free; Lawless French's move to fully-free model verified July 2026. Together with RFI/TV5Monde/InnerFrench this covers A1→B2.

### FSI language difficulty categories (US State Dept)  [RECOMMENDED]
URL: https://www.state.gov/foreign-language-training/
WHAT: Hours-to-professional-proficiency (ILR 3, roughly C1) for English L1: French = Category I, 24-30 weeks (~600-750 class hours); Mandarin = Category IV, 88 weeks (~2,200 hours). The most-cited hours baseline.
LICENSE: US-government work — public domain; the category tables can be reproduced in-app.
ACCESS: Web page; figures widely mirrored (effectivelanguagelearning.com/language-guide/language-difficulty/).
NOTES: Figures verified via multiple secondary sources in 2026. CRITICAL caveat for your user: these assume an English L1 diplomat. For a Vietnamese native speaker: no official FSI-style table exists, but Mandarin is substantially cheaper than 2,200h — Vietnamese is tonal and 50-70% of its lexicon is Sino-Vietnamese (see Alves, 'Loanwords in Vietnamese', free PDF; https://en.wikipedia.org/wiki/Sino-Vietnamese_vocabulary), giving massive vocabulary transfer (đại học/大学, chú ý/注意...); characters remain the main cost. Present FSI numbers as an upper bound for ZH and a rough guide for FR/EN.

### Cambridge English — Guided Learning Hours (CEFR)  [RECOMMENDED]
URL: https://support.cambridgeenglish.org/hc/en-gb/articles/202838506-Guided-learning-hours
WHAT: Cumulative guided-learning-hours per CEFR level: A2 ≈ 180-200h, B1 ≈ 350-400h, B2 ≈ 500-600h, C1 ≈ 700-800h, C2 ≈ 1,000-1,200h. Use for the English (and, as an analog, French) progression map.
LICENSE: Copyrighted page; the hour FIGURES are facts — cite Cambridge and reproduce the numbers freely.
ACCESS: Web (page exists; direct fetch bot-blocked, figures verified via British Council and LanguageCert mirrors: https://www.languagecert.org/en/guided-learning-hours).
NOTES: Best-sourced CEFR hour estimates available. Show as ranges with a 'guided hours ≠ total hours' caveat (self-study typically needs more).

### HSK 3.0 — Chinese Proficiency Grading Standards (GF0025-2021, CLEC/chinesetest.cn)  [RECOMMENDED]
URL: https://www.chinesetest.cn/
WHAT: Official 9-level HSK 3.0 standard: cumulative vocab 300 (HSK1) / ~1,978 (HSK4) / ~5,334 (HSK6) / 10,896 words (levels 7-9 share one pool); also character and grammar lists per level. Test transition to HSK 3.0 rolling out through 2026.
LICENSE: Chinese national standard document; the word/character/level lists are factual standard data, universally reproduced by apps (Pleco, Anki decks). Reproducing the lists with citation is standard practice; the standard PDF itself is freely published.
ACCESS: Official site + widely mirrored list data; community CSV/JSON dumps on GitHub (check per-repo licenses; several are MIT).
NOTES: Hours guidance: no official CLEC hour table for HSK 3.0; community consensus estimates HSK1 ≈ 80-100h for Western learners (hskstory.com 2026 data), less for Vietnamese speakers (Sino-Vietnamese transfer). Map HSK→CEFR loosely: HSK4-5 ≈ B1/B2 under HSK 3.0. Explainers verified alive: https://www.mandarinzone.com/new-hsk-test/ and https://chineselearner.com/hsk

### NIST CSRC Glossary  [RECOMMENDED]
URL: https://csrc.nist.gov/glossary
WHAT: 10,114 authoritative English definitions across cybersecurity, networking (5G, 6LoWPAN, TLS...), IoT and embedded-adjacent terms, aggregated from NIST publications. THE source for your IoT/professional English vocab module.
LICENSE: US-government work — public domain (17 USC §105). Bundleable in a paid app; cite the source publication per NIST's request.
ACCESS: BULK: full JSON export as ZIP, regenerated daily — perfect for one-time import into your SQLite. No API key.
NOTES: Verified alive and updating (last update May 29, 2026). Definitions are formal/spec-flavored; pair each with a simpler gloss for learners. Complement with NIST IR 8259 (IoT) and SP 800-series glossaries already included in the export.

### Wikipedia technical glossaries (Glossary of computer science etc.)  [RECOMMENDED]
URL: https://en.wikipedia.org/wiki/Glossary_of_computer_science
WHAT: Substantial curated glossaries: computer science, computer hardware, Internet-related terms, electrical & electronics engineering — hundreds of plain-English definitions suited to learners.
LICENSE: CC BY-SA 4.0 (verified). Bundling in a free OR paid app is allowed IF you attribute (link to article + license) and share adapted definition text under the same license. Not NC — fine for app-store distribution.
ACCESS: Web; bulk via MediaWiki API (keyless) or dumps.wikimedia.org.
NOTES: Verified alive. Cleaner reading level than NIST for a learner app; use NIST where authority matters, Wikipedia where readability matters.

### Wikidata (interlanguage-link trick for ZH/FR technical terms)  [RECOMMENDED]
URL: https://www.wikidata.org/wiki/Wikidata:Licensing
WHAT: Every Wikipedia article's cross-language titles now live in Wikidata as sitelinks + multilingual labels/aliases. Query 'microcontroller' → zh: 微控制器, zh-Hans/zh-Hant variants, fr: microcontrôleur, vi: vi điều khiển — instant EN↔ZH↔FR↔VN technical-term translations for thousands of IoT/CS concepts.
LICENSE: All structured data (labels, aliases, sitelinks, statements) is CC0 1.0 — VERIFIED on the licensing page. Public-domain-equivalent: bundle freely in a paid app, no attribution legally required.
ACCESS: Keyless: REST/wbgetentities API, SPARQL endpoint (query.wikidata.org), or full JSON dumps. One SPARQL query can dump all items in 'category: embedded systems' with en/zh/fr/vi labels to CSV.
NOTES: EVALUATION of the trick: it works and is the legally cleanest multilingual term source available. Strengths: excellent coverage of established technical nouns; gives you Vietnamese labels too (great for glosses); simplified/traditional Chinese handled via zh-hans/zh-hant. Weaknesses: (1) label = encyclopedic title, occasionally not the everyday engineer's term (mainland industry may say 单片机 where Wikidata's zh label is 微控制器 — keep aliases, which Wikidata also stores, and spot-check ~5% with a native source); (2) gaps for niche jargon and multi-word phrases; (3) no definitions — pair with NIST/Wikipedia definition text. Verdict: use Wikidata for translations, NIST+Wikipedia for definitions.
MEASURED WHILE BUILDING v0.7 (2026-07-31, probe + adversarial re-check over 39 then 161 real terms) — five corrections that survive contact with the data:
 1. **THE `zh` LABEL IS OFTEN TRADITIONAL** (韌體 for firmware, 編譯器 for compiler — whatever script the last editor typed). Request `zh-hans` with `&languagefallback=1`, which really variant-converts (编译器, with `source-language` provenance) — and screen even the zh-hans label afterwards: telemetry's zh-hans label is the MIXED-script "遥測", editor-typed into the simplified field itself.
 2. **`languagefallback` SUBSTITUTES ENGLISH SILENTLY**: a missing vi label returns `{value:"edge computing", language:"en", "for-language":"vi"}` under the `vi` key — 6 of 39 probed. Accept a label only when `language` equals the requested one (or `mul`, Wikidata's explicit "identical in every language", e.g. Wi-Fi); never store `.value` without checking `.language`.
 3. **VIETNAMESE COVERAGE, with its counting rule**: 134/161 curated IoT terms have a genuine vi-language label (83%); 83/161 (52%) carry Vietnamese diacritics — the rest are loanwords the vi community records verbatim (MQTT, GPIO, Raspberry Pi). Quote the first number with the second beside it.
 4. **THE 单片机 PREDICTION above is half right**: 单片机 is not an alias — it is the `zh-hans` LABEL (zh=微控制器, zh-hant=單片機, zh aliases empty). The everyday-vs-encyclopedic split is carried by the language variants, and requesting zh-hans yields the engineer's term. Elsewhere aliases do carry it (传感器 for sensor), inconsistently.
 5. **JOIN TRAPS**: the pageprops response is pageid-sorted, not request-ordered (correlate by title through normalized[]+redirects[]); disambiguation pages have VALID QIDs (bare "Node" → Q2128997, whose labels translate "list of things called node" — request `ppprop=wikibase_item|disambiguation` and reject on key presence); a redirect without `redirects=1` returns a silent null; and Wikipedia TITLES are not stable (I²C → I2C renamed live during recon), so derive stable IDs from your own slugs or the QID, never the title. Also: NIST's export is 9,541 records, not the ledgered ~10,114, 55% of them acronym-only stubs — and an acronym record can list several UNRELATED expansions ("WAP" = Web Application Proxy | Wireless Access Point | Wireless Application Protocol) while its definition defines only one, so never index a definition under a record's expansions unless there is exactly one.

### FOLDOC — Free On-Line Dictionary of Computing  [skip/low]
URL: https://foldoc.org/
WHAT: 15,284 computing definitions, hacker-culture flavored; updated Aug 2025.
LICENSE: PROBLEM: site pages show only 'Copyright Denis Howe 1985' with no explicit open license found on the copyright page (it was historically distributed under GFDL, but I could not verify a current license grant on-site). Treat as LINK ONLY until clarified.
ACCESS: Web; historical dumps exist in Linux dict packages.
NOTES: Alive but aging and license-ambiguous — superseded for your purposes by NIST (public domain) + Wikipedia (CC BY-SA) + Wikidata (CC0). Same caution applies to RFC 4949 (Internet Security Glossary, https://www.rfc-editor.org/rfc/rfc4949): free to read and reproduce verbatim, but pre-2008 RFC derivative-work rights are murky — link, don't remix.

--- SUMMARY (learning-science): Spaced repetition: use ts-fsrs v5.4.1 (MIT, actively maintained, FSRS-6) — do not hand-roll SM-2; FSRS is Anki's default since v23.10 and needs ~20-30% fewer reviews for equal retention, and the MIT license is app-store-safe. Daily design: cap new words at 5-10 per language (15-30 total across EN/ZH/FR); steady-state review load runs ~8-12x daily new intake (Anki manual's 10x rule), so 30 new/day ≈ 250-350 reviews/day ≈ 30-45 min — build this simulator into onboarding. Do all three languages daily in separate rotated blocks (spacing evidence: Kang 2016, Dunlosky 2013) rather than alternating days (FSRS punishes skipped days); avoid mid-session EN/FR mixing (similar-language interference); note honestly there's no direct RCT on 3-language days. Daily-tip content: keyword method (Atkinson & Raugh 1975, free via ERIC; 88% vs 28% recall), tone-colour association (link Hacking Chinese), French gender-by-ending 80% rule (Lyster 2006 — implement as data), and bundleable public-domain text from W.W. Atkinson's Memory (Gutenberg #41478) and Ebbinghaus. Progression maps: Cambridge guided learning hours for CEFR (A2 180-200h → C2 1,000-1,200h), FSI for French (~600-750h) and Mandarin (2,200h — present as an upper bound: a Vietnamese speaker's tones + 50-70% Sino-Vietnamese lexicon cut this substantially), HSK 3.0 official 9-level word counts (300 → 10,896) from GF0025-2021. Nearly all learner resources (BBC, RFI, TV5Monde, InnerFrench, Mandarin Corner, Chinese Grammar Wiki) are link-only — which is fine since linking is legal; the verified-active 2026 lists above give 5-7 per language, including Vietnamese-specific Elight for English. VOA Learning English is uniquely public domain (bundleable) but flag its post-USAGM-cuts fragility. Technical module: bundle NIST CSRC glossary (public domain, daily JSON bulk export) + Wikipedia glossaries (CC BY-SA 4.0 with attribution) for English definitions, and use Wikidata (CC0, keyless SPARQL/API, verified) for ZH/FR/VN term translations — the interlanguage-link trick is validated and legally clean via Wikidata, with the caveat that labels are encyclopedic titles (keep aliases, spot-check against industry usage) and definitions must come from elsewhere. Avoid bundling: Chinese Grammar Wiki (CC BY-NC-SA — NC blocks any revenue-bearing app) and FOLDOC (no verifiable open license).

========== PLATFORM ==========

### Capacitor 8 (native wrapper)  [RECOMMENDED]
URL: https://capacitorjs.com
WHAT: Wraps the existing React+Vite web build into real iOS/Android apps with native plugin access; current version @capacitor/core 8.4.2 (Capacitor 8 requires Xcode 26+ / Android Studio 2025.2.1+)
LICENSE: MIT — free for any use including paid app-store apps, no attribution screen required (keep LICENSE in source)
ACCESS: npm packages @capacitor/core, @capacitor/cli, @capacitor/ios, @capacitor/android
NOTES: Verified alive July 2026. Ionic/OutSystems killed all COMMERCIAL products (Appflow etc.) but the announcement explicitly states 'Ionic Framework and Capacitor will remain free and open source' and it is actively released. This is the recommended packaging path because it reuses the web app as-is.

### @capacitor-community/sqlite  [RECOMMENDED]
URL: https://github.com/capacitor-community/sqlite
WHAT: SQLite plugin for Capacitor: iOS/Android/Electron/Web; copyFromAssets() imports a prebuilt content.db from the app bundle — exactly what a shipped read-only content pack needs on native
LICENSE: MIT
ACCESS: npm @capacitor-community/sqlite; latest release v8.1.0 (Mar 30, 2026), tracking Capacitor 8
NOTES: Verified alive and maintained (Robin Genz / Capawesome took over from Jean-Pierre Quéau after v6). Use it for NATIVE only; its web layer (jeep-sqlite = sql.js persisted into IndexedDB via localforage) is slow for 100k+ row dictionaries — use official sqlite-wasm on web instead.

### SQLite WASM (official, sqlite.org)  [RECOMMENDED]
URL: https://sqlite.org/wasm/doc/trunk/index.md
WHAT: Official SQLite compiled to WebAssembly with OPFS persistence; run content.db (with FTS5) and user.db in the browser
LICENSE: Public domain (SQLite) — no restrictions, no attribution required
ACCESS: npm @sqlite.org/sqlite-wasm or prebuilt download from sqlite.org
NOTES: Verified: the 'opfs-sahpool' VFS explicitly requires NO COOP/COEP headers (works on GitHub Pages/Cloudflare Pages static hosting), runs in a Worker, higher performance, but no multi-tab concurrency — acceptable for a single-user study app. The plain 'opfs' VFS needs COOP/COEP (SharedArrayBuffer) if you ever want multi-tab.

### wa-sqlite  [skip/low]
URL: https://github.com/rhashimoto/wa-sqlite
WHAT: Third-party SQLite WASM with many VFS choices: IDBBatchAtomicVFS/IDBMirrorVFS (IndexedDB) and several OPFS VFSes incl. AccessHandlePoolVFS
LICENSE: MIT (relicensed from GPLv3 on 2023-02-10 — verified in README)
ACCESS: npm wa-sqlite; prebuilt artifacts in ./dist
NOTES: Verified alive, actively maintained (~980 commits). Good fallback if official sqlite-wasm OPFS gives trouble, or if you need an IndexedDB-backed VFS for older Safari. Not needed if official sqlite-wasm works for you — pick one, not both.

### Dexie.js (IndexedDB wrapper)  [skip/low]
URL: https://github.com/dexie/Dexie.js
WHAT: Ergonomic IndexedDB library — viable only for the 'static JSON pack + IndexedDB progress' fallback design
LICENSE: Apache-2.0 (verified in repo)
ACCESS: npm dexie
NOTES: Verified alive/maintained. NOT recommended as primary: no FTS5/full-text search, no SQL, and it forks your storage code from the native SQLite path. Only sensible for a throwaway v0 prototype.

### vite-plugin-pwa  [RECOMMENDED]
URL: https://github.com/vite-pwa/vite-plugin-pwa
WHAT: Zero-config-ish PWA (manifest + Workbox service worker, precache app shell, runtime-cache the content pack) for the Vite app
LICENSE: MIT (verified: 'MIT License © 2020-PRESENT Anthony Fu')
ACCESS: npm vite-plugin-pwa
NOTES: Verified alive and actively maintained. Do NOT precache the multi-MB content.db in the service worker manifest — fetch it once, store in OPFS, and version it via your own manifest.json.

### GitHub Actions macOS runners  [RECOMMENDED]
URL: https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions
WHAT: CI to build/sign/upload the iOS Capacitor app from a Windows dev machine (xcodebuild + fastlane on macOS runner)
LICENSE: Service, not data — free tier per GitHub ToS
ACCESS: GitHub-hosted macos-* runners in workflows; fastlane for signing/TestFlight upload
NOTES: Verified: standard runners are FREE UNLIMITED on public repos incl. macOS; private repos on Free plan get 2,000 min/mo with macOS billed at 10x (~200 real macOS minutes — roughly 10-15 iOS builds). A hobby project in a public repo makes this genuinely $0.

### Codemagic (free personal tier)  [RECOMMENDED]
URL: https://codemagic.io/pricing/
WHAT: Mobile-focused CI/CD; prebuilt iOS/Android pipelines incl. Capacitor
LICENSE: Service — free personal tier
ACCESS: codemagic.yaml in repo; 500 free macOS M2 build minutes/month on personal accounts, 1 concurrent build
NOTES: Verified July 2026 on official pricing page. Free minutes are personal-account only (not teams). Good backup or primary if the repo must stay private. Pay-as-you-go beyond that ($0.095/min M2).

### Ionic Appflow  [skip/low]
URL: https://ionic.io/blog/important-announcement-the-future-of-ionics-commercial-products
WHAT: Former Ionic cloud build / live-update service for Capacitor apps
LICENSE: Commercial service — DISCONTINUED
ACCESS: None for new users
NOTES: VERIFIED DEAD: new sales stopped Feb 11, 2025; all Appflow features sunset Dec 31, 2027. Open-source Capacitor is unaffected. Do not build on it; use GitHub Actions or Codemagic.

### Scaleway Apple silicon (Mac mini as a service)  [skip/low]
URL: https://www.scaleway.com/en/pricing/apple-silicon/
WHAT: Hourly cloud Mac (M4 from €0.22/hr) for occasional interactive Xcode debugging, screenshots, simulator work
LICENSE: Commercial service, pay per hour
ACCESS: Scaleway console; VNC/SSH; Paris datacenter; minimum 24h allocation per Apple licensing
NOTES: Verified: 24h minimum means each debugging session costs ~€5.3 — far cheaper than MacStadium ($109+/mo, no free trial, verified) for a hobbyist who needs a Mac a few times a year. CI handles routine builds; this covers the rare 'need a real Xcode' moments. Borrowing a friend's Mac is the $0 alternative.

### Apple Developer Program  [RECOMMENDED]
URL: https://developer.apple.com/programs/
WHAT: Mandatory membership for App Store distribution and TestFlight
LICENSE: US$99/year (varies slightly by region) — CONFIRMED unavoidable; no free path to public App Store distribution; apps removed if membership lapses
ACCESS: Enroll with Apple ID; covers unlimited apps
NOTES: The only unavoidable recurring cost in the whole plan. Defer it: ship the PWA first (free), enroll only when actually submitting. Google Play is a one-time $25 by comparison.

### PWA on iOS (interim distribution channel)  [RECOMMENDED]
URL: https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
WHAT: Add-to-Home-Screen web app as the v0.x 'install' path before app-store packaging
LICENSE: n/a (platform capability)
ACCESS: Serve the Vite PWA from any static host; user installs via Share > Add to Home Screen
NOTES: 2026 status verified: NO beforeinstallprompt on iOS (manual install only, show an instruction overlay); ~50MB Cache API cap and 7-day script-writable-storage eviction for browser-tab usage — mitigate with navigator.storage.persist() (Safari 17+) and by getting the app onto the home screen (installed web apps have their own storage/use counter); push works since 16.4 for home-screen apps. The Feb 2024 'EU kills PWAs' change was REVERSED before iOS 17.4 shipped — home-screen web apps still work in the EU, and none of this affects Vietnam. Large OPFS-stored SQLite packs are the main eviction risk: request persistence and offer cheap re-download.

### CC-CEDICT (bundling verdict)  [RECOMMENDED]
URL: https://www.mdbg.net/chinese/dictionary?page=cc-cedict
WHAT: 124,726-entry Mandarin-English dictionary (traditional+simplified+pinyin) — the core zh content for the bundled pack
LICENSE: CC BY-SA 4.0 — VERIFIED on the MDBG license page: commercial AND non-commercial use explicitly allowed; requires attribution and ShareAlike on modified data
ACCESS: Bulk download cedict_1_0_ts_utf-8_mdbg.zip / .txt.gz (UTF-8 text, keyless)
NOTES: Safe to bundle inside a free (or even paid) app-store app. Compliance recipe: in-app Licenses screen crediting CC-CEDICT/MDBG with URL + license link, and publish your converted SQLite pack under CC BY-SA (GitHub release) — that satisfies ShareAlike and neutralizes the CC anti-TPM argument about FairPlay-wrapped app bundles.

### kaikki.org (Wiktextract Wiktionary dumps)  [RECOMMENDED]
URL: https://kaikki.org/dictionary/
WHAT: Machine-readable Wiktionary: 1.77M English senses, 458k French, 387k Chinese — definitions, pronunciations, inflections for the EN/FR/ZH pack
LICENSE: Dual CC BY-SA + GFDL (verified on site; Wikimedia text is CC BY-SA 4.0 since June 2023) — redistribution in free and paid apps allowed with attribution + ShareAlike on the derived pack
ACCESS: Bulk JSONL downloads per language, keyless
NOTES: Verified alive July 2026. Same compliance recipe as CC-CEDICT: attribution screen (credit Wiktionary + kaikki.org/Tatu Ylonen per their request) and CC BY-SA on the derived pack. Ingestion note: JSONL is large — stream-parse in apps/ingest.

### Chinese Grammar Wiki (AllSet Learning)  [skip/low]
URL: https://resources.allsetlearning.com/chinese/grammar/Chinese_Grammar_Wiki:Copyrights
WHAT: Best free structured Mandarin grammar reference (graded A1-C1 grammar points)
LICENSE: CC BY-NC-SA 3.0 — NonCommercial. Their own Copyrights page states content 'may not be used for commercial purposes' and that no app generating ANY revenue (even ads) may use it
ACCESS: Web only (site 403-blocks scrapers/automated fetch — verified); no official bulk download
NOTES: DO NOT BUNDLE, even in a free personal app: App Store distribution is widely interpreted as commercial-adjacent (Apple's paid developer program + commercial storefront), the NC clause is legally ambiguous, and the site actively blocks scraping. Instead store your own list of grammar-point names/IDs with deep links (facts and URLs are not copyrightable) and open them in the browser. Write your own grammar summaries if offline grammar is needed.

### Expo / EAS Build (the road not taken)  [skip/low]
URL: https://expo.dev/pricing
WHAT: React Native framework + cloud build service; free plan = 15 iOS + 15 Android builds/month, low-priority queue, 45-min timeout — builds iOS from Windows with zero CI setup
LICENSE: Expo SDK is MIT; EAS is a freemium service (Starter $19/mo)
ACCESS: npm create expo-app; eas build -p ios from any OS
NOTES: Verified alive July 2026. The honest counterfactual: choose Expo only if starting UI from scratch and wanting first-class native modules. For this project it forfeits the existing React+Vite DOM codebase (full UI rewrite to RN primitives; react-native-web is weakest exactly where a dictionary app lives: text layout, ruby/pinyin annotations, complex typography). Capacitor + GitHub Actions reaches the same 'iOS from Windows' outcome without the rewrite.

--- SUMMARY (platform): RECOMMENDED PATH — (a) React+Vite PWA now, wrapped with Capacitor 8 later. It reuses ~100% of an existing React+Vite monorepo (Expo/RN means rewriting all UI in RN primitives; react-native-web adds friction for a DOM-heavy dictionary/reader UI). Capacitor is MIT and confirmed continuing as open source despite Ionic's commercial shutdown; the only real Expo advantage (EAS cloud iOS builds from Windows, 15 free/mo) is matched by GitHub Actions macOS runners (free on a public repo) or Codemagic (500 free macOS M2 min/mo). STORAGE DESIGN — SQLite everywhere, two databases: (1) content.db, read-only versioned pack built on the PC by apps/ingest (better-sqlite3 + FTS5 index for headword/pinyin/lemma search), shipped gzipped with a manifest.json {version, sha256, minAppVersion, size} and a meta table inside the DB; (2) user.db, read-write SRS state (FSRS scheduler) keyed by stable content IDs so packs can be swapped without losing progress, exportable as a file for backup. Web driver: official SQLite WASM (public domain) with the opfs-sahpool VFS — verified to need NO COOP/COEP headers, so it runs on plain static hosting (Cloudflare Pages/GitHub Pages) in a worker; single-tab only, which is fine for a personal app. Native driver: @capacitor-community/sqlite v8.1.0 (MIT, actively maintained, copyFromAssets imports the prebuilt content.db from the app bundle). This is exactly the Pleco-style pattern: bundled read-only dictionary database + separate mutable user database. Skip Dexie-as-primary (no FTS, divergent codepaths) and skip the plugin's jeep-sqlite web layer (sql.js-in-IndexedDB is slow for 100k+ rows). iOS FROM WINDOWS — Apple Developer Program $99/yr is unavoidable for App Store distribution (confirmed, no free path). Appflow is DEAD (sunset Dec 31, 2027) — do not adopt. Use: PWA as the interim channel (iOS: no install prompt API — manual Add to Home Screen; ~50MB Cache API cap and 7-day eviction for browser-tab use, mitigated by navigator.storage.persist() and by installing to home screen; the EU PWA removal was reversed in March 2024 and is irrelevant in Vietnam). When packaging: GitHub Actions macOS runner (free unlimited on public repos; private = 2,000 min/mo at 10x burn ≈ 200 macOS min) with fastlane for signing, Codemagic free tier as backup, Scaleway Mac mini M4 at €0.22/hr (24h minimum ≈ €5.3) for occasional interactive Xcode debugging; MacStadium ($109+/mo, no trial) not worth it for a hobbyist. LEGAL — CC BY-SA data (CC-CEDICT 4.0, Wiktionary/kaikki dual CC BY-SA+GFDL) CAN be bundled in a free App Store app: add a Licenses/Attribution screen (source name, URL, license name + hyperlink, note of modifications) and publish your derived content pack itself under CC BY-SA (e.g., a GitHub release) — this satisfies ShareAlike and defuses the App-Store-DRM/anti-TPM argument since the data remains freely obtainable. Chinese Grammar Wiki (CC BY-NC-SA 3.0) must NOT be bundled — its own copyright page says even ad-revenue apps are disallowed, and App Store distribution is commonly read as commercial-adjacent; store only grammar-point IDs/URLs in your DB and deep-link (facts and links are not copyrightable). MONOREPO (pnpm workspaces) — apps/web (React+Vite+TS, vite-plugin-pwa, sqlite-wasm worker), apps/ingest (Node CLI scripts Claude runs: download CC-CEDICT/kaikki/Tatoeba → normalize → content.db + manifest), packages/shared (types, FSRS scheduler, DB interface with web/native drivers), packages/content-pack (pack format spec + loader/verifier). NO Fastify in v0.x: the app reads a static pack and progress is local, so `pnpm dev` (Vite) plus free static hosting is the entire stack; add apps/api (Fastify) only when cross-device sync is actually wanted, and add apps/mobile (Capacitor shell consuming apps/web's dist) when going to the stores.


========== GAPS ==========
[
  {
    "topic": "French CEFR-graded vocabulary (redistributable)",
    "question": "For a free, local-first language app whose data is bundled into an app-store build, find a CEFR-graded French vocabulary list (A1–C2) that is verifiably free AND redistributable (no NC/ND clauses) as of 2026. Verify by fetching actual pages: (1) FLELex / CEFRLex at cental.uclouvain.be — the server was unreachable and the license CC BY-NC-SA when checked 2026-07-29; confirm current status, any re-licensing, or a documented written-permission route from CENTAL/Thomas François; (2) official French CEFR référentiels from France Éducation International / CIEP — do machine-readable word lists exist and under what terms; (3) the historical 'Français Fondamental' (1er/2e degré) lists — current copyright status and any clean digital source; (4) Duolingo's published open CEFR wordlist datasets (github.com/duolingo) — do they cover French and what license; (5) CEFR-labelled French lexicons on Hugging Face / academic repos (e.g., UniversalCEFR-style datasets) — exact licenses. If NOTHING redistributable exists, document the best open, citable methodology for deriving A1–C2 bands from Lexique 3.83 (CC BY-SA) frequency percentiles calibrated against official CEFR descriptors, with exact source URLs. Report exact URLs and exact license names, and flag anything NC/ND or account-gated."
  },
  {
    "topic": "Sentence-level listening audio for ZH/FR/EN",
    "question": "Word-level pronunciation audio is solved (Wikimedia Commons/Lingua Libre, audio-cmn), but no sentence- or passage-level human audio source has been verified as legally bundleable for a free app-store app. Find and verify (fetch the actual license/download pages, do not rely on memory): (1) Mozilla Common Voice — current clip license (still CC0?), whether bulk downloads are now gated behind Hugging Face accounts/agreements (a problem for a keyless pipeline), and coverage/quality for zh-CN, fr, and en; (2) Tatoeba audio — how the per-file license field appears in the bulk exports (sentences_with_audio.csv) and approximately how many CC BY / CC0 (non-NC, non-empty-license) audio files exist for cmn, fra, and eng; (3) LibriVox — confirm all recordings are public domain, and assess French and Mandarin catalog size for pairing with public-domain texts; (4) other open speech corpora usable as learner listening material: OpenSLR corpora (e.g., aishell-1/2 for Mandarin, M-AILABS for French/English, SIWIS French) — check each corpus's exact license for commercial redistribution/bundling. For every source give the exact URL, exact license name/text, download mechanism (keyless bulk vs gated), and a clear bundle-safe yes/no verdict per language."
  },
  {
    "topic": "Daily fresh reading/listening content for French and Mandarin",
    "question": "A planned feature is daily ingestion of fresh learner content, but the only verified public-domain daily source so far is VOA Learning English (English only, and fragile after the 2025-26 USAGM cuts); all French and Mandarin daily sources found (RFI, TV5Monde, YouTube channels) are link-only copyrighted media. Find and verify free sources of daily or frequently-updated news/article content (ideally text + audio) for FRENCH and MANDARIN that can legally be cached or bundled in a free local-first app, plus an English backup to VOA. Specifically fetch and verify: (1) VOA's sister services — VOA Chinese (voachinese.com) and RFI/VOA French for Africa (voaafrique.com) — confirm whether their original content shares the US-government public-domain status of VOA English (check usagm.gov/voanews terms of use) and that they are still publishing in 2026; (2) Wikinews French (fr.wikinews.org) and Chinese (zh.wikinews.org) — exact current license (CC BY 2.5?), publication activity level in 2026, and available feeds/dumps/APIs for automated daily ingestion; (3) RFI 'Le français facile' and similar broadcasters' RSS feeds — what their terms of use actually permit beyond hyperlinking (transcript/audio caching inside an app?); (4) any other openly licensed (CC BY/CC0/public-domain) simplified-language news projects in French or Chinese. For each: exact URL, exact license/terms text, whether bundling, offline caching, or only deep-linking is legal, and whether the feed is realistically stable for daily automated pulls."
  }
]

========== FOLLOWUPS (3) ==========

--- followup 0 ---

### FLELex / CEFRLex (CENTAL, UCLouvain) — original site  [skip/low]
URL: https://cental.uclouvain.be/cefrlex/flelex/
WHAT: The reference CEFR-graded French lexicon: ~17,900 lemmas (CRF tagger version; TreeTagger version also exists) with normalized frequencies per CEFR level A1–C2, estimated from 777k words of FFL textbooks and graded readers. Exactly the dataset shape the app needs.
LICENSE: CC BY-NC-SA 4.0 (Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International). NC clause makes bundling in any app-store build — even a free app — legally unsafe without written permission. No evidence of re-licensing as of 2026-07-29.
ACCESS: Normally a keyless bulk download (TSV/XLSX) at https://cental.uclouvain.be/cefrlex/flelex/download/ — but the server is DOWN: fetches on 2026-07-29 return ECONNREFUSED on 130.104.253.15, and the wider UCLouvain range (130.104.33.32, uclouvain.be directory pages) also refuses connections, so this looks like a university-wide outage rather than project shutdown; pages are still in search indexes.
NOTES: Verified unreachable 2026-07-29 (whole UCLouvain IP range refusing). License re-confirmed via the Hugging Face mirror and cached CEFRLex pages: still CC BY-NC-SA 4.0, 'download for personal research or teaching'. Written-permission route: no formal commercial-licensing form is documented anywhere; the route is emailing the project coordinator Thomas François (team page https://cental.uclouvain.be/team/tfrancois/, currently down; institutional record at https://research.dial.uclouvain.be/entities/publication/6a84a0e5-9fc7-4223-8697-205d99ad3c97; email thomas.francois@uclouvain.be appears in the LREC paper). Treat as NOT redistributable unless such permission is obtained in writing.

### FLELex mirror on Hugging Face (FrancophonIA/FLELex)  [skip/low]
URL: https://huggingface.co/datasets/FrancophonIA/FLELex
WHAT: Community mirror of FLELex: 32.1k rows across 3 subsets (CRF_Tagger ~17.9k rows; TreeTagger file FLELex_TreeTagger.txt), columns = word, POS, freq per A1–C2 + total.
LICENSE: cc-by-nc-sa-4.0 stated on the dataset card — same NC problem as the original. Flagged: NC — cannot be bundled into an app-store build.
ACCESS: Alive and keyless as of 2026-07-29 (public HF dataset, no gating; last updated 2025-03-30). Plain TXT/parquet via HF hub.
NOTES: Useful as the only reachable copy while cental.uclouvain.be is down — fine for private prototyping and for evaluating your own derived list, but the NC-SA license forbids shipping it inside the app. Community-hosted, not an official CENTAL mirror.

### France Éducation International (ex-CIEP) — CEFR référentiels  [skip/low]
URL: https://www.france-education-international.fr/document/cecrldescripteursprima11a1a2
WHAT: The official French 'Référentiels' (Beacco et al., 'Niveau A1/A2/B1/B2 pour le français') contain per-level vocabulary inventories — but they exist ONLY as commercial print books published by Éditions Didier (e.g., ISBN 2278056425, 2278058541). FEI's site offers only PDF extracts of CEFR descriptors (can-do statements), not word lists.
LICENSE: Books: standard publisher copyright (© Didier) — no reuse rights at all. FEI descriptor PDFs: no open license stated; Council-of-Europe-derived descriptor text is authorized for reproduction only for non-commercial purposes with attribution.
ACCESS: No machine-readable word lists exist from FEI/CIEP. Site is alive but bot-gated: automated fetch on 2026-07-29 returned an 'unusual activity' block page; documents are viewable in a normal browser, free, no account.
NOTES: Verified 2026-07-29: this route is a dead end for data — the official French CEFR vocabulary inventories were never released digitally or openly. Do not scrape/re-type the Didier books; that would be infringing.

### Français Fondamental (Gougenheim, Michéa, Rivenc, Sauvageot — 1er/2e degré)  [skip/low]
URL: https://fr.wikipedia.org/wiki/Fran%C3%A7ais_fondamental
WHAT: Historic ~1,475-word (1er degré) + ~1,700-word (2e degré) pedagogical French lists from the 1950s; roughly maps to A1–A2/B1 only — no C-level coverage even if usable.
LICENSE: NOT public domain and no license. Under French law a joint work is protected 70 years after the last co-author's death; Paul Rivenc died 2019-05-05 (verified via fr.wikipedia.org/wiki/Paul_Rivenc, idref.fr/027101908, data.bnf.fr), so the curated list/compilation is protected in France until ~2090. The underlying word facts may be unprotectable in the US, but France's originality threshold plus sui-generis database rights make bundling a copied list risky.
ACCESS: No clean licensed digital source exists. Only unofficial, unlicensed re-typed copies on FLE blogs, e.g. https://lexiquefle.canalblog.com/archives/2007/06/04/5182930.html and academy PDFs (e.g. prim27.ac-normandie.fr bibliography). 'Base Gougenheim 2.00' (8,774 words) circulates similarly without a license.
NOTES: Verified 2026-07-29. Flag: rights-encumbered until ~2090, incomplete CEFR coverage, and all digital copies are unauthorized. Not a safe source for a bundled database.

### Duolingo open datasets (GitHub org + research.duolingo.com + CEFR checker)  [skip/low]
URL: https://github.com/orgs/duolingo/repositories
WHAT: Answer to the direct question: Duolingo has published NO open CEFR wordlist dataset, for French or any language. The GitHub org (12 repos, verified 2026-07-29) contains only engineering tools (slack-ai-agent, minject, metasearch, halflife-regression MIT, whosaidit). research.duolingo.com offers learner-trace corpora only (2018 SLAM data: 7M words by learners of English/Spanish/French; spaced-repetition logs; STAPLE translations) — behavioral data, not graded vocabulary.
LICENSE: Repos are Apache-2.0/MIT (code, no vocab data). Research datasets are hosted on Harvard Dataverse with research-oriented terms (license not stated on research.duolingo.com; the Dataverse page is JS-gated to automated fetch). None of it is a CEFR vocabulary list.
ACCESS: github.com/duolingo alive; research.duolingo.com alive; the CEFR checker at https://cefr.duolingo.com returned HTTP 503 on 2026-07-29 — the tool appears retired, and its underlying wordlists were never released as data.
NOTES: Verified dead end 2026-07-29. Any 'Duolingo vocab list' repos on GitHub (jmbeach/duolingo-vocab-lists etc.) are unauthorized API scrapes of Duolingo's copyrighted course content — do not bundle.

### UniversalCEFR (Hugging Face org) — French subset readme_fr  [skip/low]
URL: https://huggingface.co/datasets/UniversalCEFR/readme_fr
WHAT: 26-corpus multilingual CEFR-labeled collection (13 languages). French holding is readme_fr: 1,669 sentence-level TEXTS labeled A1–C2 (from the ReadMe++ readability benchmark) — texts, not a vocabulary list.
LICENSE: cc-by-nc-sa-4.0 on the dataset card; the org states the compilation is for non-commercial research, and several member corpora require separate ToS or are gated. Flagged: NC.
ACCESS: readme_fr itself is keyless and downloadable on HF (verified 2026-07-29); other org datasets vary (some gated/ToS-bound). Project page: https://universalcefr.github.io/.
NOTES: Wrong data shape (texts, not words) AND NC-licensed — doubly unsuitable for bundling. Could serve as a non-shipped evaluation set for your difficulty classifier during development only.

### KELLY project CEFR word lists (Sharoff mirror, Leeds)  [skip/low]
URL: https://ssharoff.github.io/kelly/
WHAT: Corpus-based A1–C2 vocabulary lists from the EU KELLY project (2009–2011) — but only Arabic, Chinese, Russian, Italian, English on this mirror (Greek/Swedish external). The French KELLY list described in the Springer paper (doi 10.1007/s10579-013-9251-2) has no surviving public download.
LICENSE: CC BY-NC-SA 2.0 stated on the page — NC, so unusable for bundling even where available.
ACCESS: GitHub Pages mirror alive (xls files); the old corpus.leeds.ac.uk/serge/kelly/ host refused connections on 2026-07-29; kellyproject.eu is long dead.
NOTES: Verified 2026-07-29: no French list obtainable, and the license is NC anyway. Listed to document the dead end. (Chinese KELLY here is also NC — same problem for your Mandarin track.)

### Lexique 3.83 (New et Pallier) — RECOMMENDED base for a self-derived CEFR banding  [RECOMMENDED]
URL: http://www.lexique.org/
WHAT: ~140,000 French words / ~50k lemmas with film-subtitle frequency (freqfilms2), book frequency (freqlivres), POS, lemma, gender/number, phonology, syllabification. The only high-quality French lexical database that is genuinely redistributable.
LICENSE: CC BY-SA 4.0 (Creative Commons Attribution-ShareAlike 4.0 International) — verified 2026-07-29 in the official README (github.com/chrplr/openlexicon/blob/master/datasets-info/Lexique383/README-Lexique.md states CC BY SA 4.0 + LICENSE-CC-BY-SA4.0.txt). Commercial use and redistribution allowed with attribution ('New & Pallier, Lexique 3.83, lexique.org') and share-alike on the derived table — compatible with a free or paid app as long as the derived word table itself stays CC BY-SA.
ACCESS: Bulk TSV download, keyless: http://www.lexique.org/databases/Lexique383/Lexique383.zip (note: https on www.lexique.org has a certificate-name misconfiguration as of 2026-07-29 — use the http URL or the mirrors). Docs + mirror via OpenLexicon: http://openlexicon.fr and https://github.com/chrplr/openlexicon (verified alive).
NOTES: Verified 2026-07-29. This is the recommended path: derive A1–C2 bands yourself from Lexique frequencies (methodology below) — the derivation is a lawful derivative work under CC BY-SA.

### FLELex LREC 2014 paper (methodology citation for CEFR banding)  [RECOMMENDED]
URL: https://aclanthology.org/L14-1083/
WHAT: 'FLELex: a graded lexical resource for French foreign learners' — François, Gala, Watrin, Fairon, LREC 2014, pp. 3766–3773. Documents exactly how CEFR levels are assigned to French lemmas (first-occurrence level across a graded textbook corpus, dispersion-weighted normalized frequencies) — the citable recipe to replicate over open data.
LICENSE: Paper text: CC BY-NC-SA 3.0 (ACL Anthology license for pre-2016 material). You cite and follow the method; you do not bundle the paper or the FLELex data, so NC on the PDF is irrelevant to the app.
ACCESS: Free keyless PDF via ACL Anthology (verified alive 2026-07-29; original PDF also at lrec-conf.org).
NOTES: Use as the primary methodological citation for your derived list ('bands assigned following the FLELex first-occurrence approach, recomputed on CC BY-SA data'). Methods/facts are not copyrightable — replicating the procedure on Lexique data creates a clean CC BY-SA derivative.

### Milton & Alexiou (2009) — vocabulary-size anchors per CEFR level  [RECOMMENDED]
URL: https://link.springer.com/chapter/10.1057/9780230242258_12
WHAT: 'Vocabulary size and the Common European Framework of Reference for Languages' (in Richards ed., Vocabulary Studies in First and Second Language Acquisition, Palgrave). Reports measured X_Lex vocabulary sizes per CEFR level for learners of FRENCH (plus Greek, Spanish): roughly A1 <1,000 lemmas, A2 ~1,000–2,000, B1 ~2,000–3,000, B2 ~3,000–3,750, C1 ~3,750–4,500, C2 ~4,500–5,000 within the top-5,000 frequency band.
LICENSE: Chapter is paywalled (Springer/Palgrave, © authors/publisher). You only need the numeric thresholds, which are uncopyrightable facts — cite the chapter, don't reproduce its text.
ACCESS: DOI page verified alive 2026-07-29 (redirects to Springer auth = paywall). Author-shared copies circulate on ResearchGate/Academia for reading.
NOTES: This is the standard citable bridge from frequency rank to CEFR band: sort Lexique 3.83 lemmas by dispersion-weighted freqfilms2/freqlivres, then cut at ~1k/2k/3k/3.75k/4.5k/5k for A1→C2, extending C1/C2 with lower-frequency bands (e.g., 5k–8k, 8k–15k) since C-levels exceed 5k in practice. Cross-check band assignments against FLELex via the HF mirror (privately, not shipped).

### CEFR descriptors — Council of Europe Companion Volume (calibration reference only)  [RECOMMENDED]
URL: https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors
WHAT: Official CEFR 2020 Companion Volume with all A1–C2 descriptor scales, free PDF (also at rm.coe.int). Needed to sanity-check that each derived band's vocabulary supports the level's can-do functions (e.g., A1 survival topics, B1 narration, C1 abstract/academic).
LICENSE: © Council of Europe. Reproduction of extracts authorized for non-commercial purposes with attribution — so do NOT bundle descriptor text in the app; use it only to design/document the banding and write your own level blurbs.
ACCESS: Free, no account, in a normal browser; the site returned HTTP 403 to automated fetch on 2026-07-29 (bot protection), but is alive.
NOTES: Flag: NC-style reuse terms on descriptor text. Fine as methodology input; not fine as bundled content.

### FrequencyWords (hermitdave) — OpenSubtitles 2018 French frequency lists  [RECOMMENDED]
URL: https://github.com/hermitdave/FrequencyWords
WHAT: Plain-text French frequency lists from OpenSubtitles2018 (content/2018/fr/: fr_50k.txt, fr_full.txt) — a second, independent spoken-register frequency signal to stabilize your rank-based banding (also covers en and zh_cn for your other two languages).
LICENSE: Repo README: 'MIT License for code. CC-BY-SA-4.0 for content' — content redistributable in the app with attribution + share-alike, same family as Lexique.
ACCESS: Keyless raw-file download from GitHub; repo and the content/2018/fr directory verified alive 2026-07-29.
NOTES: Use as a cross-check/tie-breaker when Lexique film vs. book frequencies disagree; averaging ranks across independent corpora reduces register bias in band cutoffs. CC BY-SA obligations stack cleanly with Lexique's.
SUMMARY: As of 2026-07-29 there is NO ready-made French A1–C2 vocabulary list that is both free and redistributable: (1) FLELex/CEFRLex is CC BY-NC-SA 4.0 and its host is unreachable (ECONNREFUSED across the whole UCLouvain range — looks like a temporary university-wide outage, not project death; the only reachable copy is the HF mirror FrancophonIA/FLELex, same NC license; the only permission route is emailing coordinator Thomas François — nothing formal is documented); (2) the official FEI/CIEP référentiels exist only as commercial Didier print books, with FEI publishing just descriptor PDFs; (3) Français Fondamental is copyright-protected in France until ~2090 (last co-author Paul Rivenc died 2019) with only unlicensed blog copies online; (4) Duolingo never published open CEFR wordlists — its GitHub org has none and cefr.duolingo.com now returns 503; (5) HF CEFR French resources (UniversalCEFR/readme_fr) are NC-licensed sentence corpora, not word lists; KELLY has no surviving French list and is NC anyway. Therefore the recommended, legally clean path is to DERIVE your own bands: take Lexique 3.83 (verified CC BY-SA 4.0, keyless bulk TSV at lexique.org / OpenLexicon / github.com/chrplr/openlexicon), rank lemmas by dispersion-weighted film+book frequency (optionally averaged with hermitdave/FrequencyWords fr_50k, CC BY-SA 4.0), cut bands at the Milton & Alexiou (2009) vocabulary-size anchors (~1k/2k/3k/3.75k/4.5k/5k+ lemmas for A1→C2), follow the FLELex first-occurrence methodology (aclanthology.org/L14-1083) as the citable procedure, sanity-check against CEFR Companion Volume descriptors (reference only — its text is NC), and privately validate against the FLELex HF mirror without shipping it. Ship the resulting table in SQLite under CC BY-SA 4.0 with attribution to New & Pallier (Lexique) and hermitdave/OpenSubtitles — fully compatible with a free or paid app-store app.

--- followup 1 ---

### Mozilla Common Voice (official channel, now Mozilla Data Collective)  [RECOMMENDED]
URL: https://commonvoice.mozilla.org/en/datasets
WHAT: Crowdsourced read sentences (scripted speech), 1-10 s clips with transcript TSVs. CV 26.0 (2026-06-12, verified from official metadata repo github.com/common-voice/cv-dataset): English 2,785 validated hours / 1.9M validated clips; French 1,102 validated hours / 788k clips; zh-CN only 240 validated hours out of 1,074 recorded (huge unvalidated backlog, so zh-CN usable set is much smaller and quality is mixed: variable mics, accents, occasional misreads). Also zh-TW 80 h and zh-HK 109 h validated.
LICENSE: CC0 1.0 (public domain dedication) for all existing Common Voice datasets — confirmed in Mozilla's own announcement: "The existing Common Voice datasets will continue to be accessible under the CC-0 licence they were released with" (discourse.mozilla.org/t/exciting-news-mozilla-data-collective/145191). CC0 = bundling in free or paid app-store apps allowed, no attribution required. WARNING: future releases may carry other licenses per-dataset (CC-BY, CC-BY-SA, NOODL) — check each datasheet from 23.0 onward.
ACCESS: GATED since October 2025: official downloads moved exclusively to Mozilla Data Collective (mozilladatacollective.com); requires creating an account and agreeing to its Terms of Service (browser, API, or their Python library). The old commonvoice.mozilla.org email-gated direct download is discontinued; official Hugging Face repos (mozilla-foundation/common_voice_*) stopped at 17.0 and are login-gated. Format: per-language .tar.gz of MP3 clips + TSV transcripts.
NOTES: Verified alive 2026-07-29. The clip LICENSE itself is bundle-safe (CC0) for en/fr/zh-CN — verdict YES for all three languages once you have the files — but the official acquisition pipeline is no longer keyless. Since CC0 permits redistribution, use the ungated mirror below for a keyless pipeline. zh-CN caveat: only ~190k validated clips; filter by up_votes and clip duration.

### Common Voice ungated mirror (fsicoli on Hugging Face)  [RECOMMENDED]
URL: https://huggingface.co/datasets/fsicoli/common_voice_22_0
WHAT: Community re-upload of Common Voice Corpus 22.0 (578 GB total, 100+ languages) converted from commonvoice.mozilla.org, including English, French, Chinese (China/Hong Kong/Taiwan). Earlier versions (17.0-19.0) also mirrored under the same account.
LICENSE: cc0-1.0 (CC0 1.0 Universal), same as upstream — redistribution in free or paid app-store apps allowed, no attribution legally required (courteous to credit Common Voice contributors anyway).
ACCESS: KEYLESS: public, NOT gated (verified 2026-07-29 — no login, no conditions to accept). Bulk download via plain HTTPS from https://huggingface.co/datasets/fsicoli/common_voice_22_0/resolve/main/... (per-language audio archives + TSVs) or the datasets library; anonymous downloads work for ungated public repos.
NOTES: This is the practical keyless path to CC0 sentence audio now that Mozilla gates official downloads behind a Data Collective account. Legally sound because CC0 permits re-hosting. Risk: unofficial mirror could disappear or lag behind releases (currently at 22.0 vs official 26.0) — pull once, cache locally. Verdict: bundle-safe YES for en, fr, zh-CN.

### Tatoeba audio (per-clip licensed sentence recordings)  [RECOMMENDED]
URL: https://tatoeba.org/en/downloads
WHAT: Native-speaker recordings of Tatoeba example sentences, tied to the sentence corpus (ideal: audio + text + translations share sentence IDs). Site total 1,237,566 recordings. LICENSE-FILTERED counts I computed 2026-07-29 from the live per-language exports (field 4 of *_sentences_with_audio.tsv): ENG 849,774 total but 835,383 are CC BY-NC-ND 3.0 (contributor CK — NOT bundleable) and 6,435 empty-license; usable = 3,342 CC BY 4.0 + 3,321 CC BY-SA 4.0 ≈ 6,663 clips. FRA 9,833 total; usable = 2,126 CC BY-SA 4.0 (5,755 CC BY-NC 4.0 and 1,953 empty are not). CMN 5,827 total; usable = 0 (5,743 empty-license, 84 CC BY-NC 4.0).
LICENSE: Per-file, contributor-chosen; recorded in the export's license field with attribution URL. Official rule verified on the downloads page: "If the license field is empty, you may not reuse the audio outside the Tatoeba project." Filter to CC BY 4.0 (attribution) and CC BY-SA 4.0 (attribution; ShareAlike binds derivative works of the audio, not your app as a whole — bundling unmodified clips in a collection is fine, keep clips under their own license). Exclude all NC/ND and empty rows programmatically.
ACCESS: KEYLESS bulk: https://downloads.tatoeba.org/exports/per_language/{eng|fra|cmn}/{lang}_sentences_with_audio.tsv.bz2 (fields: sentence_id, audio_id, username, license, attribution_url), then fetch MP3s directly from https://audio.tatoeba.org/sentences/{lang}/{sentence_id}.mp3 (verified 200 OK, audio/mpeg, no key). Weekly-refreshed exports.
NOTES: Verified alive and counted 2026-07-29. Verdict: ENG YES (~6.6k clips — modest but high-value beginner sentences), FRA YES (~2.1k clips, notably user vlecomte's CC BY-SA set), CMN NO (zero legally bundleable clips — do not use Tatoeba for Mandarin audio). Store username + attribution URL per clip in SQLite for CC BY compliance.

### LibriVox (public-domain audiobooks)  [RECOMMENDED]
URL: https://librivox.org/pages/public-domain/
WHAT: Volunteer-read audiobooks of pre-1929 public-domain texts. Catalog counts I computed 2026-07-29 by paging the full catalog API: English 19,430 books (enormous), French 323 books (plenty of graded-length classics: Dumas, Verne, Maupassant), Chinese only 28 books — and those are mostly classical/literary Chinese (文言) read aloud, of limited use for modern-Mandarin listening. Chapter-level MP3/OGG hosted on archive.org; pairs naturally with Project Gutenberg texts for read-along passages.
LICENSE: Public domain dedication, verified exact text: "all our recordings are public domain (definitely in the USA, and maybe in your country as well)... This means anyone can use all our recordings however they wish (even to sell them)" and "The recordings are free, and there is no need to credit LibriVox, although of course we much prefer if you do." Caveat stated by LibriVox: PD status is asserted under US law; verify locally for non-US distribution (low practical risk for pre-1929 works in Vietnam/EU stores).
ACCESS: KEYLESS: JSON catalog API https://librivox.org/api/feed/audiobooks/?format=json&limit=...&offset=... (note: the language filter parameter is unreliable — fetch catalog pages and filter the language field client-side, which is what I did); direct MP3/ZIP downloads from archive.org URLs in each record. Site blocks some non-browser user agents — send a normal User-Agent header.
NOTES: Verified alive 2026-07-29 (WebFetch got 403 but curl with a browser UA works fine). Verdict: ENG YES, FRA YES, CMN effectively NO for modern Mandarin (28 mostly-classical books). Audio quality varies by volunteer; whole chapters (10-30 min) suit intermediate+ extensive listening, not beginners.

### Multilingual LibriSpeech (MLS) — OpenSLR SLR94  [RECOMMENDED]
URL: https://www.openslr.org/94/
WHAT: LibriVox audiobooks segmented into 10-20 s utterances WITH aligned transcripts — solves the passage-with-text problem that raw LibriVox leaves to you. 8 languages including English (~44,660 h) and French (~1,077 h). No Mandarin. 16 kHz FLAC/OPUS + transcript files.
LICENSE: "License: CC BY 4.0" (exact line on the OpenSLR page). Attribution required (credit MLS/Meta AI and cite Pratap et al. 2020); commercial redistribution and app bundling allowed.
ACCESS: KEYLESS bulk: direct HTTPS/S3 links on the OpenSLR page (e.g. mls_french.tar.gz, mls_french_opus.tar.gz; English split into 100 GB parts). No registration.
NOTES: Verified alive 2026-07-29. Verdict: ENG YES, FRA YES, CMN N/A. Best single source of sentence/passage-level French human audio with transcripts (1,000+ hours). Huge — sample a curated subset (e.g. clearest speakers) into your SQLite bundle rather than shipping whole tarballs.

### AISHELL-1 — OpenSLR SLR33  [RECOMMENDED]
URL: https://www.openslr.org/33/
WHAT: Mandarin read-speech corpus from Beijing Shell Shell Technology: ~178 hours, 400 native speakers, ~140k utterances of full sentences (news/finance/tech domains) with transcripts. Clean 16 kHz WAV, professionally validated (95%+ transcription accuracy).
LICENSE: "Apache License v.2.0" (exact phrase on the OpenSLR page and in the corpus's own license file). Apache 2.0 allows commercial use and redistribution; requires including the license text/NOTICE attribution in your app. Minor wrinkle: the page description also says "the data is free for academic use" — but the operative attached license is Apache 2.0, which the AISHELL-1 paper (arXiv 1709.05522) confirms as the release license.
ACCESS: KEYLESS bulk: direct links data_aishell.tgz (15 GB) + resource_aishell.tgz from EU/CN mirrors, no registration.
NOTES: Verified alive 2026-07-29. Verdict: CMN YES — this is the primary bundleable source of Mandarin sentence audio (clear native speakers, real sentences, transcripts). Speech is read/neutral, not conversational; pair transcripts with your dictionary for graded listening.

### AISHELL-3 — OpenSLR SLR93  [RECOMMENDED]
URL: https://www.openslr.org/93/
WHAT: Mandarin multi-speaker TTS corpus: "roughly 85 hours of emotion-neutral recordings spoken by 218 native Chinese mandarin speakers and total 88035 utterances", 44.1 kHz, with Chinese-character transcripts and pinyin annotations (pinyin is a bonus for a learning app).
LICENSE: "Apache License v.2.0" (exact phrase on the OpenSLR page). Commercial redistribution/bundling allowed with license text + attribution included.
ACCESS: KEYLESS bulk: direct link data_aishell3.tgz (19 GB), EU/CN mirrors, no registration.
NOTES: Verified alive 2026-07-29. Verdict: CMN YES. Higher audio fidelity than AISHELL-1 (recorded for speech synthesis); good for pronunciation-model listening. Do not confuse with AISHELL-2, which is NOT free for this use (see separate entry).

### THCHS-30 — OpenSLR SLR18  [skip/low]
URL: https://www.openslr.org/18/
WHAT: Free Chinese Speech Corpus from Tsinghua University CSLT: ~30-35 hours of Mandarin read sentences with transcripts (data_thchs30.tgz, 6.4 GB), plus lexicon resources.
LICENSE: "Apache License v.2.0" (exact phrase on the OpenSLR page). Commercial redistribution/bundling allowed with attribution/license inclusion.
ACCESS: KEYLESS bulk: direct download from EU/CN mirrors, no registration.
NOTES: Verified alive 2026-07-29. Verdict: CMN YES. Smaller and older than AISHELL; sentences drawn from large news corpora. Use as supplementary Mandarin material behind AISHELL-1/3.

### AISHELL-2 (aishelltech application portal)  [skip/low]
URL: https://opendata.aishelltech.com/
WHAT: 1,000 hours of clean Mandarin read speech — but NOT usable for this project (see license).
LICENSE: Academic research ONLY. Verified exact statements on the portal: "This database can ONLY be used for research purposes. Any commercial usage is not allowed" / "仅支持学术研究，未经允许禁止商用". NOT bundle-safe in any app-store app (a distributed app, even free, is not academic research).
ACCESS: GATED: application form requiring institutional affiliation and an institutional email ("Public email address (e.g., 163.com, qq.com or gmail.com) is not accepted").
NOTES: Verified 2026-07-29. Verdict: CMN NO — explicitly excluded. Listed here so it isn't mistaken for its Apache-licensed siblings AISHELL-1 (SLR33) and AISHELL-3 (SLR93).

### M-AILABS Speech Dataset (mirror)  [skip/low]
URL: https://github.com/i-celeste-aurora/m-ailabs-dataset
WHAT: LibriVox/Project-Gutenberg-derived audiobook speech segmented into sentence-level WAV (16 kHz mono) with aligned transcripts, ~1,000 h total across 8 languages: French 190 h 30 min, English-US 102 h 07 min, English-UK 45 h 34 min. No Mandarin.
LICENSE: Custom BSD-3-Clause-style "M-AILABS Speech Dataset" license, verified from the mirror repo: "Redistribution and use in any form, including any commercial use, with or without modification are permitted provided that the following conditions are met" (conditions: retain the license/copyright notice; no endorsement use; warranty disclaimer). Underlying audio is LibriVox public domain (the Ukrainian-only restriction doesn't affect fr/en). Bundle-safe including paid apps; keep LICENSE file in the app.
ACCESS: KEYLESS bulk from the surviving mirror: https://ics.tau-ceti.space/data/Training/stt_tts/fr_FR.tgz (verified 200 OK, 15.9 GB, 2026-07-29); en_US.tgz / en_UK.tgz alongside. IMPORTANT: the original home caito.de is DEAD (DNS no longer resolves) — the dataset survives only via mirrors (tau-ceti.space, Hugging Face e.g. gigant/m-ailabs_speech_dataset_fr).
NOTES: Verified mirror alive 2026-07-29. Verdict: FRA YES, ENG YES, CMN N/A. Overlaps in spirit with MLS; MLS is bigger and better maintained for French, but M-AILABS is pre-segmented at sentence level which may fit a study app better. Mirror longevity is the main risk — download and archive promptly.

### SIWIS French Speech Synthesis Database (Edinburgh DataShare)  [RECOMMENDED]
URL: https://datashare.ed.ac.uk/handle/10283/2353
WHAT: ~10 hours / 9,750 utterances of high-quality studio French read by one professional female voice talent (sentences from parliament debates and novels, incl. emphasis subset), with per-utterance text files. Single consistent model voice — excellent as a 'reference pronunciation' voice for French sentences.
LICENSE: Creative Commons Attribution 4.0 International (CC BY 4.0) — the DataShare item ships an end-user licence file specifying CC BY 4.0 (mirror README quotes "Creative Commons Attribution 4.0 International (CC BY 4.0) licence"). Attribution to the SIWIS project required; commercial bundling allowed.
ACCESS: KEYLESS: direct ZIP download (~2.67 GB) from the DataShare page, no authentication. Ungated Hugging Face mirror: https://huggingface.co/datasets/Aviv-anthonnyolime/SIWIS_French_Speech_Synthesis_Database (license tag cc-by-4.0).
NOTES: Verified alive 2026-07-29. Verdict: FRA YES. Studio quality beats Common Voice/LibriVox for clarity; only one voice, so combine with MLS/Common Voice for speaker variety.
SUMMARY: Sentence/passage-level human audio is legally solvable for all three languages, but by different routes. Key 2025-2026 change verified: Mozilla moved official Common Voice downloads exclusively to Mozilla Data Collective (account + ToS = gated), yet the clips remain CC0, so the ungated fsicoli Hugging Face mirror (v22.0, verified not gated) is the keyless bulk path — bundle-safe for en/fr/zh-CN alike. Tatoeba audio must be filtered by its per-file license field: my counts from the live exports show usable (CC BY/CC BY-SA, non-NC, non-empty) clips of ~6,663 English and 2,126 French, but ZERO Mandarin — 835k English clips are CK's CC BY-NC-ND and all 5.7k Mandarin clips have empty licenses, so treat Tatoeba as an en/fr-only audio source. LibriVox is confirmed fully public domain ('even to sell them'): huge for English (19,430 books), decent for French (323), useless for modern Mandarin (28 mostly-classical books); for segmented, transcript-aligned audiobook audio prefer MLS (SLR94, CC BY 4.0, keyless S3: 44.7k h English, 1.08k h French). Mandarin's gap is filled by OpenSLR's Apache-2.0 corpora — AISHELL-1 (178 h), AISHELL-3 (85 h + pinyin), THCHS-30 (~30 h), all keyless direct downloads; avoid AISHELL-2 (verified academic-only, institutional-email application). French gets extra polish from SIWIS (CC BY 4.0, 10 h studio voice) and optionally M-AILABS (BSD-style commercial-OK, but original site dead — use the verified tau-ceti/HF mirrors). Recommended bundle: Common Voice mirror (all three) + MLS/LibriVox + SIWIS for French passages + AISHELL-1/3 for Mandarin sentences + Tatoeba CC-BY(-SA) subsets for en/fr beginner sentences; store per-clip attribution (Tatoeba username/URL, CC BY credits, Apache NOTICE) in SQLite, ship license texts in the app, and exclude every NC/ND/empty-license file programmatically.

--- followup 2 ---

### VOA Chinese (美国之音中文网)  [RECOMMENDED]
URL: https://www.voachinese.com/
WHAT: Full daily news service in Simplified Chinese: text articles, video, radio/podcast audio (新闻及采访音频 zone has 250 audio episodes). Verified publishing daily — RSS items dated 27-28 Jul 2026, article slugs contain 20260727. Topic and section RSS feeds listed at /rssfeeds; podcast feeds at /podcast/?zoneId=NNNN (e.g. 1738). Text output is daily; the sampled podcast zone lagged (latest audio Jan 2026).
LICENSE: US government work — public domain. Verified exact text of VOA Terms of Use (voanews.com/p/5338.html, fetched 2026-07-29): 'All text, audio and video material produced exclusively by the Voice of America is in the public domain. Credit for any use of VOA material should be given to voanews.com, Voice of America, or VOA.' Bundling and offline caching in a free or paid app is legal for VOA-produced content. CAVEATS: AFP/AP/Reuters wire text/photos/video embedded in pages are copyrighted and must be stripped ('may not be copied, published or redistributed'); 'Voice of America' is a trademark not usable 'for commercial purposes' — use plain-text credit, not branding.
ACCESS: Keyless RSS 2.0 (XML) per section/topic: https://www.voachinese.com/rssfeeds lists /api/z... endpoints (verified working, e.g. https://www.voachinese.com/api/zbttml-vomx-tpeqigy). Article HTML is scrapable; MP3/MP4 media on gdb.voanews.com CDN. Sitemaps at /sitemap.xml.
MEASURED WHILE BUILDING v0.6 (2026-07-31): the working section feed is **https://www.voachinese.com/api/zm_yql-vomx-tpeybti** ('新闻') — 20 items spanning ~2 days, newest 2.5 h old at fetch time. **Do not resolve it from /rssfeeds at run time:** two fetches two minutes apart returned two structurally different pages (46 VOA Learning English programme feeds one time, 27 Chinese section feeds the next). Pin the token. Per-item fields are title/description/link/guid/pubDate/category×N/author/enclosure — the enclosure is always a JPEG, never audio, so audio requires the article page. The `<description>` is a real one-or-two-sentence VOA-written summary, which is a better daily-sized read than the full article. Body container is `#article-content > .wsw`. Wire screening still applies (none of 5 sampled zh articles carried an agency byline, unlike VOA Learning English's 35%), and it is native-register news, so no level may be claimed.
NOTES: Verified alive 2026-07-29. The ONLY verified public-domain DAILY Mandarin source. Institutional risk: USAGM was gutted in 2025 (~200 staff remain), but Congress restored FY2026 funding (~$199.5M) and the Mandarin service is one of the few kept actively publishing. News register is native-level, not graded — pair with a dictionary/segmentation layer for learners. Strip agency-credited images. Feeds have been stable Pangea-CMS endpoints for years; realistically fine for daily automated pulls with a fallback if the feed freezes (as happened to other VOA services in Mar 2025).

### VOA Afrique (French) — frozen archive, watch for revival  [RECOMMENDED]
URL: https://www.voaafrique.com/
WHAT: VOA's French-to-Africa service: French news text, video, and radio audio. VERIFIED FROZEN: all-content RSS (https://www.voaafrique.com/api/epiqq) latest item 31 Mar 2025; homepage 'headlines' are March-2025 stories (Eto'o CAF election, SAMIDRC withdrawal) despite a misleading fresh render timestamp; RSF/allAfrica confirm VOA Africa broadcasts suspended since the March 2025 USAGM shutdown and silent into 2026. Site and full archive remain online (HTTP 200).
LICENSE: Same US-government public-domain status as VOA English — verified on VOA Afrique's OWN Terms & policy page (http://m.voaafrique.com/p/5739.html, fetched 2026-07-29), which carries the identical statement: 'All text, audio and video material produced exclusively by the Voice of America is in the public domain. Credit... should be given.' AP-licensed material excepted. Bundling the archive (text + MP3s) in your app is legal with a VOA credit line.
ACCESS: Scrape article pages + frozen RSS endpoints (/rssfeeds lists ~40 /api/ feeds, each returning the last 20 items as of ~Mar 2025); media files on gdb.voanews.com still downloadable. No dumps — you must crawl.
NOTES: Not a daily source today, but it is the best LEGAL bundleable corpus of French news text+audio (decades of PD material, African/international news register). Poll its epiqq feed monthly: if VOA's court-ordered/Congress-funded revival restores the French service, it instantly becomes your daily French pipeline. Do not rely on it for freshness now.

### VOA News English + VOA Learning English — frozen archive (correction to premise)  [RECOMMENDED]
URL: https://learningenglish.voanews.com/
WHAT: IMPORTANT CORRECTION: both voanews.com and learningenglish.voanews.com are effectively FROZEN at mid-March 2025, verified 2026-07-29 — voanews.com all-content RSS (/api/epiqq) ends 15 Mar 2025, homepage articles are all March-2025 stories (article IDs ~8.01M vs VOA Chinese's current 8.17M); Learning English program feeds (News Words, Education Tips, All About America) all end Feb-Mar 2025 and sampled section pages show newest items ~Mar 2025. The '2026' timestamps on their homepages are page-render times, not article dates. The huge Learning English archive (graded text + slow-speed MP3 for nearly every article, Let's Learn English courses) remains fully online.
LICENSE: US government work — public domain per VOA Terms of Use (https://www.voanews.com/p/5338.html, fetched and quoted above). Bundleable with 'Voice of America' plain-text credit; strip AFP/AP/Reuters-credited items and images; VOA name/logo is trademarked (no commercial branding use).
ACCESS: Crawl article pages + /rssfeeds RSS endpoints (frozen but serve last items); MP3s on av.voanews.com / gdb.voanews.com CDNs; sitemap.xml chunks for URL discovery.
NOTES: Treat as a bundled seed corpus (thousands of graded articles with audio — ideal for a learner app), not a daily feed. Monitor for revival: Congress funded VOA for FY2026 and litigation (Widakuswara v. Lake) continues, so daily English output may resume. Until then, use Global Voices EN (below) for fresh English text.
MEASURED WHILE BUILDING v0.6 (2026-07-31) — three numbers that change how this source must be used:
 1. **A THIRD OF IT IS NOT PUBLIC DOMAIN.** Of 900 article pages crawled, **314 (35%) carry a trailing wire byline** — "Mark Long reported this story for the Associated Press. Anna Matteo adapted it for VOA Learning English", "Daniel Lawler with Issam Ahmed reported this story for Agence France-Presse". VOA's grant covers material produced *exclusively* by VOA, so those are AP's and AFP's, not ours. Note the two shapes mean opposite things: a trailing "reported this story for X" byline disqualifies the piece, while an inline "spoke to the Associated Press" is a quoted attribution and does not. Screen per article; `packages/shared/src/wire.ts` holds the rule and `pack verify` re-applies it over the finished pack.
 2. **THE LEVEL IS NOT IN THE DATA.** VOA Learning English publishes at three levels, but no article carries one: the only "Beginning/Intermediate/Advanced Level" strings on an article page are the site-wide nav, identical everywhere. The three level landing pages (/p/5609, /p/5610, /p/5611) are an editorial index of PROGRAMMES and they contradict the programmes' own descriptions — the Advanced page lists "Words & Their Stories", whose own blurb says it is written "at the intermediate and upper-beginner level". Do not copy a level from this site.
 3. **SIZE.** The sitemap holds 67,274 URLs of which 32,737 are articles (the rest are program pages with no body); 125 entries dated 2026 are auto-generated livestream stubs with no `.wsw` container. Text averages ~3.9 KB/article (~128 MB raw for all of it). Audio is two files per article under voa-audio.voanews.eu, `_hq` at 6,901,386 bytes and the plain one at 3,450,715 — so the full audio set is ~113 GB and cannot be bundled at any scale. Body container is exactly `<div class="wsw">`; the per-article glossary sits behind `<h2 class="wsw__h2">Words in This Story</h2>`.

### Wikinews français — CLOSED project, usable archive  [RECOMMENDED]
URL: https://fr.wikinews.org/
WHAT: ~20k French news articles, 2005-2026. VERIFIED via API and on-wiki announcement: the WMF Board approved closing Wikinews in ALL languages (announced 30 Mar 2026 on Meta/wikimedia-l by trustee Victoria Doronina, after a 28 Jun 2025 Sister Projects Task Force proposal); all editions went READ-ONLY on 4 May 2026. Last FR articles: Apr 2026 ('Wikinews ne sera plus mis à jour à partir du 4 mai 2026'); activity was already a trickle (a few articles/month in early 2026). Zero future daily value; pages stay readable and dumps stay downloadable.
LICENSE: Split license, verified from site footer (fetched 2026-07-29): articles published 24 Sep 2005 – 2 Jan 2025 → Creative Commons Attribution 2.5 (CC BY 2.5); text created after 2 Jan 2025 → Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0). Both permit bundling in free or paid apps with per-article attribution (author list/link); the small post-2025 slice additionally requires share-alike on modified text. No NC/ND anywhere.
ACCESS: Bulk XML dumps at https://dumps.wikimedia.org/frwikinews/ (monthly, 20260701 verified present); MediaWiki Action API (https://fr.wikinews.org/w/api.php, keyless JSON) for extracts/categories, e.g. Catégorie:Article publié.
NOTES: Good one-time bundled corpus of clean, sober French news prose (mostly CC BY 2.5, the easiest license here). NOT a feed — do not build ingestion against it. Simple French relative to Le Monde, though not learner-graded.

### Wikinews 中文 — CLOSED and long-dormant archive  [skip/low]
URL: https://zh.wikinews.org/
WHAT: Chinese Wikinews archive (~10k articles, mixed Simplified/Traditional with MediaWiki variant conversion). Verified: same project-wide WMF closure (read-only since 4 May 2026), and it was already dormant before that — recent-changes API shows only user-creation/maintenance log entries, no new published articles in 2026. No daily value.
LICENSE: Creative Commons Attribution 4.0 (CC BY 4.0) — verified from zh.wikinews.org footer link to creativecommons.org/licenses/by/4.0/ ('本站的全部文字在 知识共享 署名 4.0协议 之条款下提供'). Attribution-only: bundling in free/paid apps fine with credit.
ACCESS: Dumps at https://dumps.wikimedia.org/zhwikinews/ (20260701 verified); MediaWiki API at https://zh.wikinews.org/w/api.php (keyless). Use action=parse with variant=zh-cn to get consistent Simplified text.
NOTES: Small, uneven, dated corpus — lower value than FR Wikinews, but license is clean CC BY 4.0. Only worth bundling as supplementary graded-reading filler, not as news.

### RFI 'Le journal en français facile' / francaisfacile.rfi.fr — VERIFIED NOT LEGALLY CACHEABLE  [skip/low]
URL: https://francaisfacile.rfi.fr/
WHAT: Daily 10-min slow-French news podcast with transcripts — pedagogically the best daily French source, BUT legally link-only. rfi.fr blocks bots (403). Parent France Médias Monde CGU verified (https://www.francemm.com/fr/legal-notice, fetched 2026-07-29).
LICENSE: All rights reserved. Exact CGU text: 'toute reproduction (y compris par téléchargement, impression etc.) ou représentation partielle ou intégrale, adaptation, traduction, transformation et/ou transfert vers un autre site d'un ou de plusieurs des éléments précités est interdite' and 'Il est également strictement interdit de collecter, stocker, utiliser, extraire, reproduire, directement ou indirectement... tout ou partie des Contenus sans autorisation... de façon automatique ou manuelle', plus a formal TDM opt-out (tdm-reservation: 1 in /.well-known/tdmrep.json). Storing transcripts or MP3s inside your app = explicit violation.
ACCESS: Public podcast RSS exists (for personal podcast clients) and the site is free to visit — so the ONLY legal integration is deep-linking / opening the episode page or official embed in a webview, streamed live from RFI's servers, nothing cached or redistributed.
NOTES: Keep as an outbound 'listen on RFI' link in the app; do not ingest. Same CGU covers France 24 and TV5Monde-style FMM properties. Feed itself is stable, but that is irrelevant given the license.

### Global Voices en français  [RECOMMENDED]
URL: https://fr.globalvoices.org/
WHAT: Citizen-media/world-news articles in French (mostly professional volunteer translations of Global Voices English). Verified ACTIVE: feed items dated 27 Jul 2026, several articles per week to daily. Text + images only, no audio. ~20 yr old project, WordPress platform.
LICENSE: Creative Commons Attribution 3.0 (CC BY 3.0) — verified in site footer ('Licence 3.0 Creative Commons — mention de l'auteur, du site et lien') and in the Republishing Guidelines (fetched): 'all content created by Global Voices is published under a Creative Commons Attribution-Only license... Share... Adapt... for any purpose, even commercially.' Requirement: author name + link to the original story at the top of the republished piece. Bundling, offline caching, excerpting, and even simplification (adaptation) are all legal in a free or paid app.
ACCESS: Keyless WordPress RSS: https://fr.globalvoices.org/feed/ (supports ?paged=N for backfill); full-content scraping permitted by license; no API key, no rate-limit drama at daily-pull volumes.
NOTES: Your best DAILY French text source that you may legally cache and bundle. Register is journalistic B1-C1 French. No audio — generate it locally with an on-device/offline TTS (e.g. Piper) since CC BY allows derivatives. Feed verified stable and fresh 2026-07-29.

### Global Voices English (backup to VOA for English)  [RECOMMENDED]
URL: https://globalvoices.org/
WHAT: Original English edition — verified very active (feed items 28-29 Jul 2026, multiple daily). World-news feature articles, text only.
LICENSE: Creative Commons Attribution 3.0 (CC BY 3.0), same verified Republishing Guidelines: adapt and redistribute for any purpose including commercially, with author credit + link to original.
ACCESS: Keyless RSS https://globalvoices.org/feed/ (15 items, ?paged=N backfill), full-text scraping permitted.
NOTES: The practical daily-English replacement while VOA English is frozen: legally cacheable, bundleable, and adaptable (you may simplify articles for learners — impossible with ND-licensed sources). Add local TTS for audio. Note their Simplified-Chinese edition (zhs.globalvoices.org) is stale since Oct 2024 and Traditional (zht) only sporadic (last May 2026) — do NOT rely on Global Voices for Mandarin.
MEASURED WHILE BUILDING v0.6 (2026-07-31), and the first point is a licence bug waiting to happen:
 1. **`<dc:creator>` IS NOT THE AUTHOR.** On the French feed it names the TRANSLATOR on 10 items out of 10, and the same happens on the English feed for syndicated pieces (e.g. `dc:creator` "Liam Anderson" where the writer is "MigraMundo"). CC BY's one real condition is naming the author, so using this field credits the wrong person on most rows — the same shape as v0.4's French audio, where a licence field was filled from the wrong place. The correct credit is in the body: `<div class='gv-rss-footer'>` holds `<div class='text-credits-section'><span class='credit-label'>Written (English) by</span><a href=…>NAME</a></div>` sections, where a "Traduit"/"Translated" label marks the translator.
 2. **THE FEED CARRIES NO MACHINE-READABLE LICENCE.** The English channel says "Creative Commons Attribution, see our Attribution Policy" in prose with no URL; the French feed says nothing at all (0 occurrences of "creativecommons" in 175,875 bytes). The checkable `rel="license"` is on the ARTICLE page — but read it only from `div.post-credit-container`, because the pages also carry third-party image licences (a CC BY-SA 3.0 Wikimedia photo) and an RDF block with a malformed doubled-slash URL. A page-wide regex records somebody else's photograph's licence.
 3. **THE FULL BODY IS IN THE FEED**, so no article scraping is needed for the text: `<content:encoded>` runs 7,400 (EN) to 9,300 (FR) characters of text against a `<description>` of ~170. Strip `<p class='originally-published'>` and the footer div before storing.

### The Conversation France  [RECOMMENDED]
URL: https://theconversation.com/fr
WHAT: Daily expert-written news-analysis articles in French (academics + journalists). Verified fresh: Atom feed items timestamped 29 Jul 2026, ~50 items in feed, weekday-daily output. Text (occasionally podcasts, which are also CC).
LICENSE: Creative Commons Attribution-NoDerivatives (CC BY-ND) — verified on 'Règles de republication' (https://theconversation.com/fr/republishing-guidelines): 'Nous croyons à la libre circulation de l'information et publions ainsi sous licence Creative Commons Attribution/Pas de modification.' Republishing whole articles online or in print is free and encouraged; you must credit authors + institutions + The Conversation with a link, may only alter titles/dates/links, and they ask you to include their 1x1 tracking pixel when republishing online. FLAG: ND means NO excerpting, simplification, or translation without author agreement — bundle/caches must be verbatim full articles.
ACCESS: Keyless Atom feed https://theconversation.com/fr/articles.atom (verified working); per-article 'Republish' button provides clean HTML. No API key needed.
NOTES: High-quality daily French reading at B2-C2 level; legally cacheable verbatim in a free app (their model is built on republication). The ND restriction makes it unsuitable for cloze/simplified exercises derived from the text — use it as-is for extensive reading. English and Spanish editions carry the same license if you want parallel content.

### Wikipedia 'In the news' — fr 'Actualités' & zh 新闻动态  [RECOMMENDED]
URL: https://fr.wikipedia.org/w/api.php
WHAT: Community-curated daily news blurbs (2-6 one-sentence items/day) on the French and Chinese Wikipedia main pages, plus full encyclopedic background articles on each event. Updated every day by large active communities — the most future-proof daily-updated open text in both languages now that Wikinews is closed. zh serves Simplified via variant conversion (variant=zh-cn).
LICENSE: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0) — standard Wikipedia footer license since June 2023. Bundling/caching in free or paid apps is legal with attribution (link to article + license); ShareAlike applies only to the text and your modifications of it, not to your app code.
ACCESS: Keyless MediaWiki Action API (JSON): fetch/parse the ITN templates (fr: 'Modèle:Accueil actualité'; zh: main-page news template via Portal:新闻动态) and article extracts via action=query&prop=extracts; also REST /page/summary endpoints. Wikimedia asks for a descriptive User-Agent; generous rate limits; dumps also available.
CORRECTION (2026-07-31, measured while building v0.6): **the Chinese page name above is wrong for ingest.** 'Portal:新闻动态' redirects to 'Portal:新聞動態', which transcludes the content and returns 508 KB with 778 list items, and reports its OWN revision id (91051468, Jan 2026) as the attribution handle for text that lives in a different page. The real content page is **Template:Itn** (pageid 13673): 5 items, 15 KB, and a revid that means what it says. The French name IS correct as ledgered. Two further parse traps, both measured: (a) the French list NESTS — one top-level entry can hold a sub-list of two separate events and carry no sentence of its own, so a flat `<li>` regex yields phantom items and a depth-0 split yields an empty one; (b) under `variant=zh-cn` the link HREFS stay traditional while the `title` attributes are converted (`href="/wiki/熊本縣"` with `title="熊本县"`), so display text must come from the attribute. Licence: do not assert it — `action=query&meta=siteinfo&siprop=rightsinfo` returns each wiki's own statement, and each links its LOCALISED deed (`…/by-sa/4.0/deed.fr` vs `deed.zh`), which is the same licence and must be compared after stripping the suffix.
NOTES: Not long-form journalism — short factual sentences, ideal as daily bite-sized reading with linked deep-dives. Extremely stable infrastructure (Wikimedia APIs have run for 20 years). Note: the nicer api.wikimedia.org /feed/v1/.../featured endpoint's 'news' section exists only for English (verified: fr and zh responses lack the news key), so parse the wiki templates instead.

### UN News français / 中文 (联合国新闻) — verified NOT bundleable  [skip/low]
URL: https://news.un.org/fr/
WHAT: Daily UN news in both French (news.un.org/fr) and Chinese (news.un.org/zh) with text + radio-style audio — superficially the perfect bilingual source, checked because it is tempting.
LICENSE: Proprietary. UN Terms of Use verified (https://www.un.org/en/about-us/terms-of-use, fetched 2026-07-29): permission is granted 'to download and copy the information... for the User's personal, non-commercial use, without any right to resell or redistribute them or to compile or create derivative works therefrom.' Redistribution inside an app — even a free one — is outside the grant.
ACCESS: Public RSS feeds exist per language; legal use in your app is limited to headline display with deep links to news.un.org (RSS headline use with linkback is the conventional tolerated use), or streaming their pages in a webview.
NOTES: Deep-link only. Do not cache text or audio. Listed to save you re-investigating it later.

### Radio Free Asia Mandarin — not usable (for completeness)  [skip/low]
URL: https://www.rfa.org/mandarin/
WHAT: Mandarin news from USAGM grantee RFA. Unlike VOA (a federal entity whose works are US-government public domain), RFA is a private nonprofit grantee — its content is copyrighted, not public domain. RFA also suspended most operations in 2025 after USAGM grant terminations and remains skeletal.
LICENSE: © Radio Free Asia, all rights reserved (grantee content is NOT covered by the VOA public-domain rule). No republication without permission.
ACCESS: Website/RSS exist but only deep-linking is legal; operational continuity is poor anyway.
NOTES: Included so the 'VOA is public domain' logic is not over-extended: it does NOT apply to USAGM grantees (RFA, RFE/RL, MBN). Skip.
SUMMARY: Verified live on 2026-07-29. Two premise corrections drive the plan: (1) the WMF Board closed Wikinews in ALL languages — read-only since 4 May 2026 — so fr/zh Wikinews are bundleable archives (FR: CC BY 2.5 pre-2025 + CC BY-SA 4.0 after; ZH: CC BY 4.0; monthly dumps still generated), not daily sources; (2) within VOA, only VOA Chinese is actually publishing daily (RSS items 27-29 Jul 2026), while voanews.com English, Learning English, and VOA Afrique are all frozen at mid-March 2025 (their '2026' homepage timestamps are render times). VOA's Terms of Use, confirmed verbatim on both voanews.com and VOA Afrique's own terms page, put all VOA-produced text/audio/video in the public domain (credit requested; AFP/AP/Reuters material and the VOA trademark excluded) — so bundle freely but strip wire-agency images. Recommended daily pipeline: MANDARIN = VOA Chinese RSS (public domain, text daily + podcast audio) + zh.wikipedia 新闻动态 blurbs (CC BY-SA 4.0); FRENCH = Global Voices en français (CC BY 3.0, allows adaptation/simplification — pair with local TTS like Piper for audio) + The Conversation France (CC BY-ND — verbatim-only full articles, daily Atom feed) + fr.wikipedia Actualités; ENGLISH backup = Global Voices English (CC BY 3.0, daily) while monitoring VOA English for revival (FY2026 funding restored, litigation ongoing). Bundle as seed corpora: VOA Afrique's frozen archive (the only large public-domain French news text+audio corpus), VOA Learning English's graded archive with MP3s, and the Wikinews dumps. Confirmed NOT legal to cache/bundle: RFI/France Médias Monde (CGU expressly prohibit any reproduction, storage, or automated extraction, with a formal TDM opt-out — deep-link only), UN News fr/zh (personal, non-commercial, no-redistribution grant), and RFA (copyrighted grantee, unlike public-domain VOA). Ship per-article attribution metadata (author/source/license URL) in your SQLite schema now — every usable license above requires it.