/**
 * seed:sentences — Tatoeba example sentences (CC BY 2.0 FR), filtered to words we actually ship.
 *
 * Attribution is per sentence, not per corpus: CC BY 2.0 FR requires crediting the contributor,
 * so every row stores `sentence #<id> by <username>` and `pack verify` fails if any is missing.
 *
 * ONLY sentence text is taken here. Tatoeba *audio* is per-clip licensed and mostly unusable —
 * see seed:sentence-audio for the filtering, and note that CMN has zero bundleable clips.
 *
 * Selection: iterate sentences shortest-first and hand each one to the pack words it contains,
 * up to MAX_PER_WORD each. Shortest-first matters — it is what makes the chosen examples
 * beginner-legible rather than whatever happened to be in the corpus first.
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import bz2 from 'unbzip2-stream';
import { pinyin } from 'pinyin-pro';
import { sentenceId } from '@mls/shared';
import { download, sha256File } from '../../lib/download';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'tatoeba';
const BASE = 'https://downloads.tatoeba.org/exports/per_language';
const PARSER_VERSION = 6;

const MAX_PER_WORD = 3; //          examples per word — enough to vary, small enough to stay cheap
const MAX_PER_LANG = 30_000; //      cap on sentences kept per language (pack-size guard)
const MAX_LEN = 70; //               characters; longer sentences are not useful examples
// Shortest-first alone picks degenerate "examples" — 哈哈, "Ok!", "Si." are real Tatoeba
// sentences but teach nothing. Require enough substance to show the word in use.
const MIN_HAN = 3; //                zh: Han characters (keeps 我学习, drops 哈哈)
const MIN_LATIN_LEN = 12; //         en/fr: characters (drops "Ok!", "So?", "Oh!")
const MAX_IDS_PER_FORM = 4; //       homographs: don't fan one sentence out to every reading

interface LangSpec {
  tatoeba: string; //  'cmn'
  pack: string; //     'zh'
  /** Whether sentences need an English translation to be worth keeping. */
  needsTranslation: boolean;
}

const LANGS: LangSpec[] = [
  { tatoeba: 'cmn', pack: 'zh', needsTranslation: true },
  { tatoeba: 'fra', pack: 'fr', needsTranslation: true },
  { tatoeba: 'eng', pack: 'en', needsTranslation: false },
];

async function* bz2Lines(path: string): AsyncGenerator<string> {
  const rl = createInterface({ input: createReadStream(path).pipe(bz2()), crlfDelay: Infinity });
  for await (const line of rl) yield line;
}

const isHan = (ch: string): boolean => /\p{Script=Han}/u.test(ch);
const hanCount = (s: string): number => [...s].filter(isHan).length;

/**
 * Tatoeba is an open corpus and contains plenty of profanity, violence and sexual content.
 * Shortest-first selection actively favours it — before this filter the rank-0 example for
 * HSK1 妈 ("mum") was 操你妈！, for 他/她 it was 殺了他/殺了她, and for A1 "her" it was
 * "I raped her." A study app must not hand a beginner that as its canonical example.
 *
 * Applied to BOTH the sentence and its English translation, and it rejects the sentence
 * outright rather than deranking it — otherwise it merely becomes example #2.
 */
const BLOCK_LATIN =
  /\b(?:rape[ds]?|raping|molest\w*|incest|pedophil\w*|paedophil\w*|fuck\w*|shit\w*|cunt\w*|bitch\w*|whore\w*|slut\w*|bastard|dick|cock|penis|vagina|anus|masturbat\w*|orgasm|porn\w*|prostitut\w*|brothel|nigger|faggot|kike|chink|spic|retard\w*|kill(?:s|ed|ing)?|murder\w*|suicide|slaughter\w*|massacre\w*|behead\w*|strangl\w*|stab(?:s|bed|bing)?|shoot(?:s|ing)?|shot\s+(?:him|her|them)|corpse|hang(?:ed|ing)\s+himself|nazi|hitler|terroris\w*|genocide|torture\w*|abus(?:e|ed|ive)|drunk\w*|cocaine|heroin|marijuana)\b/i;
const BLOCK_HAN =
  /(操你|干你|他妈的|妈的|傻逼|混蛋|婊子|妓女|强奸|強姦|做爱|做愛|性交|阴茎|陰莖|阴道|陰道|自慰|色情|杀了|殺了|杀死|殺死|谋杀|謀殺|自杀|自殺|想死|去死|该死|該死|屠杀|屠殺|强盗|強盜|恐怖分子|纳粹|納粹|希特勒|吸毒|海洛因|大麻|妈逼|滚蛋|滾蛋)/;

const isBlocked = (text: string, trans: string | null): boolean =>
  BLOCK_HAN.test(text) || BLOCK_LATIN.test(text) || (trans !== null && (BLOCK_LATIN.test(trans) || BLOCK_HAN.test(trans)));

/** Is this sentence substantial enough to be a useful example? */
const isUsable = (text: string, lang: string): boolean =>
  lang === 'zh' ? hanCount(text) >= MIN_HAN : text.length >= MIN_LATIN_LEN;

/**
 * Sentence pinyin.
 *
 * pinyin-pro's dictionary is keyed on SIMPLIFIED words. Fed traditional text its segmentation
 * misses and it falls back per character, silently picking the wrong polyphone — measured on
 * the first v0.4 pack: 嗎 read "má" (the particle is neutral "ma") in 307/307 sentences, 麼
 * "mó" in 204/204, 們 "mén" in 590/590, 車 "jū" in 125/125. The fix is upstream of the
 * transcription: traditional sentences are rejected outright (see traditionalOnlyChars), and on
 * simplified-only input pinyin-pro is context-aware and correct.
 *
 * Reading each segment from CC-CEDICT instead was tried and is measurably WORSE: picking a
 * headword's most frequent entry gives 吗 "má", 行 "háng" and even a capitalised "Néng" from a
 * proper-noun entry, because a single character's entries carry no sentence context.
 *
 * Two residual errors pinyin-pro makes on simplified text are corrected below: erhua and the
 * structural 得.
 */
/** Pronoun-ish characters before 得 that suggest the modal děi rather than the complement de. */
const DEI_SUBJECTS = new Set(['我', '你', '您', '他', '她', '它', '们', '咱', '谁']);

function readingFor(text: string, erhuaWords: Set<string>): string {
  // One entry per CHARACTER (punctuation included), so the array stays aligned with `chars`.
  const syllables = pinyin(text, { toneType: 'symbol', type: 'array' }) as string[];
  const chars = [...text];
  const out: string[] = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    let syl = syllables[i] ?? ch;

    // Erhua: 哪儿 is "nǎr", not "nǎ ér". Only merge when the preceding characters plus 儿 form a
    // real 儿-word in our own lexicon, so 儿子 ("ér zi") and other 儿-initial words are untouched.
    // Longest-first because the word can be longer than two characters (一块儿, 一点儿).
    if (ch === '儿' && i > 0 && out.length > 0) {
      let merged = false;
      for (let n = Math.min(3, i); n >= 1 && !merged; n--) {
        if (erhuaWords.has(`${chars.slice(i - n, i).join('')}儿`)) {
          out[out.length - 1] += 'r';
          merged = true;
        }
      }
      if (merged) continue;
    }

    // Structural 得 between two Han characters is the neutral complement marker (做得好 =
    // "zuò de hǎo"), which pinyin-pro reads as "dé". Skipped after a pronoun, where 得 is more
    // likely the modal děi — that case stays as pinyin-pro left it rather than being made
    // confidently wrong in a new direction.
    if (
      ch === '得' && syl === 'dé' &&
      i > 0 && isHan(chars[i - 1]!) && !DEI_SUBJECTS.has(chars[i - 1]!) &&
      i + 1 < chars.length && isHan(chars[i + 1]!)
    ) {
      syl = 'de';
    }

    out.push(syl);
  }

  let text_ = '';
  for (const part of out) {
    if (!text_) text_ = part;
    else if (/^[，。！？、；：·»）】》,.!?;:)\]]/.test(part)) text_ += part; //  no space before closers
    else if (/[（【《«([]$/.test(text_)) text_ += part;
    else text_ += ' ' + part;
  }
  return text_.trim();
}
/** Tatoeba writes SQL-style \N for a missing value. */
const nullable = (s: string | undefined): string | null => (!s || s === '\\N' ? null : s);

/**
 * Characters that only ever appear in a TRADITIONAL form in our own lexicon.
 *
 * The Tatoeba cmn dump mixes simplified and traditional, but this pack is simplified
 * throughout — HSK headwords, stroke animations and word audio are all simplified — so a
 * traditional example neither matches the glyphs we teach nor transcribes correctly. Derived
 * from the data instead of a hardcoded list: chars seen in `alt_form` but never in `headword`.
 */
function traditionalOnlyChars(db: DB): Set<string> {
  const simplified = new Set<string>();
  const traditional = new Set<string>();
  for (const r of db
    .prepare(`SELECT headword, alt_form FROM words WHERE lang = 'zh'`)
    .all() as { headword: string; alt_form: string | null }[]) {
    for (const ch of r.headword) if (isHan(ch)) simplified.add(ch);
    if (r.alt_form) for (const ch of r.alt_form) if (isHan(ch)) traditional.add(ch);
  }
  for (const ch of simplified) traditional.delete(ch);
  return traditional;
}

/**
 * Two-character 儿-words whose CC-CEDICT reading really is erhua (ends in a bare "r"), e.g.
 * 哪儿 "na3 r5", 事儿, 一点儿. Used to merge the retroflex ending instead of pronouncing it as
 * a separate ér syllable — and, because it is derived from the lexicon rather than a rule,
 * 儿子 and other 儿-initial words are never touched.
 */
function erhuaWordSet(db: DB): Set<string> {
  const out = new Set<string>();
  for (const r of db
    .prepare(`SELECT headword, reading FROM words WHERE lang = 'zh' AND headword LIKE '%儿' AND reading IS NOT NULL`)
    .all() as { headword: string; reading: string }[]) {
    // 2–4 characters: 一块儿 and 一点儿 are erhua too, not just the two-character pairs.
    const len = [...r.headword].length;
    if (len >= 2 && len <= 4 && /\sr$/.test(r.reading)) out.add(r.headword);
  }
  return out;
}

/** headword (or lowercase form) → word ids, capped so a common word can't fan out. */
function wordForms(db: DB, lang: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const rows = db
    .prepare(`SELECT id, headword FROM words WHERE lang = ? ORDER BY freq_rank IS NULL, freq_rank`)
    .all(lang) as { id: string; headword: string }[];
  for (const r of rows) {
    const key = lang === 'zh' ? r.headword : r.headword.toLowerCase();
    const list = map.get(key);
    if (!list) map.set(key, [r.id]);
    else if (list.length < MAX_IDS_PER_FORM) list.push(r.id);
  }
  return map;
}

/**
 * Greedy longest-match segmentation against our own headword list.
 *
 * Scanning every 1–4 character substring instead (the first implementation) "finds" a word
 * whenever its characters straddle a boundary between two other words: 我没有名字 matched
 * 有名 (没有+名字), 客人们 matched 人们 (客人+们), 加拿大人 matched 大人. Those became
 * rank-0 examples for words the sentence never actually uses.
 */
function segmentZh(text: string, forms: Map<string, string[]>): string[] {
  const chars = [...text];
  const out: string[] = [];
  for (let i = 0; i < chars.length; ) {
    if (!isHan(chars[i]!)) { i++; continue; }
    let taken = 0;
    for (let n = Math.min(4, chars.length - i); n >= 1; n--) {
      const candidate = chars.slice(i, i + n).join('');
      if (forms.has(candidate)) { out.push(candidate); taken = n; break; }
    }
    i += taken || 1;
  }
  return out;
}

/** Which pack words appear in this sentence. zh segments; others tokenise. */
function wordsIn(text: string, lang: string, forms: Map<string, string[]>): string[] {
  const hits = new Set<string>();
  if (lang === 'zh') {
    for (const seg of segmentZh(text, forms)) {
      for (const id of forms.get(seg) ?? []) hits.add(id);
    }
  } else {
    for (const token of text.toLowerCase().split(/[^\p{L}\p{N}'’-]+/u)) {
      if (token.length < 2) continue;
      const ids = forms.get(token) ?? forms.get(token.replace(/[’']s$/, ''));
      if (ids) for (const id of ids) hits.add(id);
    }
  }
  return [...hits];
}

/** Credits the sentence author AND, when we bundle one, the translation's own author. */
function attributionFor(c: Candidate, engId: string | undefined, engUser: Map<string, string>): string {
  const base = `sentence #${c.nativeId}${c.username ? ` by ${c.username}` : ''}`;
  const who = engId ? engUser.get(engId) : undefined;
  const trans = engId ? `; translation #${engId}${who ? ` by ${who}` : ''}` : '';
  return `${base}${trans}, CC BY 2.0 FR`;
}

interface Candidate {
  nativeId: string;
  text: string;
  username: string | null;
}

export async function run(db: DB): Promise<void> {
  // --- downloads -----------------------------------------------------------------------
  const files: Record<string, string> = {};
  for (const l of LANGS) {
    files[l.tatoeba] = await download({
      id: `tatoeba:${l.tatoeba}_sentences_detailed`,
      url: `${BASE}/${l.tatoeba}/${l.tatoeba}_sentences_detailed.tsv.bz2`,
      relPath: `tatoeba/${l.tatoeba}_sentences_detailed.tsv.bz2`,
      license: 'CC BY 2.0 FR (sentence text; per-sentence attribution required)',
    });
  }
  for (const l of ['cmn', 'fra']) {
    files[`${l}-eng`] = await download({
      id: `tatoeba:${l}-eng_links`,
      url: `${BASE}/${l}/${l}-eng_links.tsv.bz2`,
      relPath: `tatoeba/${l}-eng_links.tsv.bz2`,
      license: 'CC BY 2.0 FR (translation links)',
    });
  }

  const inputSha =
    LANGS.map((l) => sha256File(files[l.tatoeba]!).slice(0, 16)).join('') +
    `-p${PARSER_VERSION}`;
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ sentences unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'Tatoeba example sentences',
    url: 'https://tatoeba.org',
    license: 'CC BY 2.0 FR',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/fr/',
    attributionText:
      'Example sentences from the Tatoeba Project (https://tatoeba.org), licensed CC BY 2.0 FR. Each sentence keeps its own contributor credit and Tatoeba sentence number.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  // --- translation links: <lang sentence id> → <english sentence id> --------------------
  const linkTo = new Map<string, string>(); //   `${lang}:${id}` → eng id
  const neededEng = new Set<string>();
  for (const l of ['cmn', 'fra']) {
    for await (const line of bz2Lines(files[`${l}-eng`]!)) {
      const [from, to] = line.split('\t');
      if (!from || !to) continue;
      const key = `${l}:${from}`;
      if (!linkTo.has(key)) {
        linkTo.set(key, to);
        neededEng.add(to);
      }
    }
  }
  console.log(`  links: ${linkTo.size} sentences have an English translation`);

  const tradOnly = traditionalOnlyChars(db);
  const erhua = erhuaWordSet(db);
  console.log(`  lexicon: ${tradOnly.size} traditional-only characters, ${erhua.size} erhua words`);

  // --- english pass: collect translation texts AND the EN example candidates ------------
  const engText = new Map<string, string>();
  // The English translation is a SEPARATE CC BY 2.0 FR work by a different contributor, so it
  // needs its own credit — attributing only the source-language author under-credits ~46k
  // English sentences we bundle and display.
  const engUser = new Map<string, string>();
  const candidates: Record<string, Candidate[]> = { zh: [], fr: [], en: [] };
  for await (const line of bz2Lines(files['eng']!)) {
    const [id, , text, username] = line.split('\t');
    if (!id || !text) continue;
    if (neededEng.has(id)) {
      engText.set(id, text);
      const u = nullable(username);
      if (u) engUser.set(id, u);
    }
    if (text.length <= MAX_LEN && isUsable(text, 'en') && !isBlocked(text, null))
      candidates['en']!.push({ nativeId: id, text, username: nullable(username) });
  }
  console.log(`  english: ${engText.size} translations resolved, ${candidates['en']!.length} EN candidates`);

  // --- cmn / fra candidates -------------------------------------------------------------
  for (const l of LANGS.filter((x) => x.needsTranslation)) {
    for await (const line of bz2Lines(files[l.tatoeba]!)) {
      const [id, , text, username] = line.split('\t');
      if (!id || !text || text.length > MAX_LEN || !isUsable(text, l.pack)) continue;
      const engId = linkTo.get(`${l.tatoeba}:${id}`) ?? '';
      const trans = engText.get(engId);
      if (trans === undefined) continue; //  untranslated ⇒ unusable as an example
      if (isBlocked(text, trans)) continue;
      // Simplified pack: a traditional example matches neither our glyphs nor our readings.
      if (l.pack === 'zh' && [...text].some((c) => tradOnly.has(c))) continue;
      candidates[l.pack]!.push({ nativeId: id, text, username: nullable(username) });
    }
    console.log(`  ${l.pack}: ${candidates[l.pack]!.length} translated candidates`);
  }

  // --- assign shortest-first, capped per word -------------------------------------------
  const insertSentence = db.prepare(`
    INSERT INTO sentences (id, lang, text, trans_en, trans_vi, reading, audio_id, level_est, source_id, attribution)
    VALUES (@id, @lang, @text, @trans_en, NULL, @reading, NULL, NULL, '${SOURCE_ID}', @attribution)
    ON CONFLICT(id) DO UPDATE SET
      text = excluded.text, trans_en = excluded.trans_en, reading = excluded.reading,
      attribution = excluded.attribution`);
  const insertLink = db.prepare(`
    INSERT INTO word_sentences (word_id, sentence_id, rank) VALUES (@word_id, @sentence_id, @rank)
    ON CONFLICT(word_id, sentence_id) DO UPDATE SET rank = excluded.rank`);

  // Re-running with stricter filters must REMOVE rows that no longer qualify. Upserts alone
  // leave the old selection behind, so clear this source's rows first — scoped by source_id so
  // nothing else in staging is touched.
  const cleared = db.prepare(`SELECT COUNT(*) AS n FROM sentences WHERE source_id = ?`).get(SOURCE_ID) as { n: number };
  db.transaction(() => {
    db.prepare(`DELETE FROM word_sentences WHERE sentence_id IN (SELECT id FROM sentences WHERE source_id = ?)`).run(SOURCE_ID);
    db.prepare(`DELETE FROM sentences WHERE source_id = ?`).run(SOURCE_ID);
  })();
  if (cleared.n > 0) console.log(`  cleared ${cleared.n} sentences from a previous run`);

  let totalSentences = 0;
  let totalLinks = 0;
  for (const l of LANGS) {
    const forms = wordForms(db, l.pack);
    const pool = candidates[l.pack]!;
    // Shortest first: simple sentences make better examples and cover common words anyway.
    pool.sort((a, b) => a.text.length - b.text.length || a.nativeId.localeCompare(b.nativeId));

    const used = new Map<string, number>(); //  word id → examples assigned
    let kept = 0;
    db.transaction(() => {
      for (const c of pool) {
        if (kept >= MAX_PER_LANG) break;
        const wordIds = wordsIn(c.text, l.pack, forms).filter((w) => (used.get(w) ?? 0) < MAX_PER_WORD);
        if (wordIds.length === 0) continue; //  teaches nothing we ship

        const sid = sentenceId(l.pack as 'zh' | 'en' | 'fr', SOURCE_ID, c.nativeId);
        const engId = linkTo.get(`${l.tatoeba}:${c.nativeId}`);
        insertSentence.run({
          id: sid,
          lang: l.pack,
          text: c.text,
          trans_en: engId ? (engText.get(engId) ?? null) : null,
          // zh readings are generated, not taken from Tatoeba's patchy transcriptions export.
          reading: l.pack === 'zh' ? readingFor(c.text, erhua) : null,
          attribution: attributionFor(c, engId, engUser),
        });
        for (const w of wordIds) {
          const rank = used.get(w) ?? 0;
          insertLink.run({ word_id: w, sentence_id: sid, rank });
          used.set(w, rank + 1);
          totalLinks++;
        }
        kept++;
      }
    })();
    totalSentences += kept;
    const covered = used.size;
    console.log(`  ✓ ${l.pack}: ${kept} sentences covering ${covered} words`);
  }

  recordRun(db, SOURCE_ID, totalSentences, inputSha);
  console.log(`  ✓ sentences: ${totalSentences} sentences, ${totalLinks} word links`);
}
