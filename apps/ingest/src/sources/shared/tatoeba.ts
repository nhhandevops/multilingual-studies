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
const PARSER_VERSION = 3;

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

/** Is this sentence substantial enough to be a useful example? */
const isUsable = (text: string, lang: string): boolean =>
  lang === 'zh' ? hanCount(text) >= MIN_HAN : text.length >= MIN_LATIN_LEN;

/**
 * pinyin-pro spaces every token, including punctuation ("xué 。"). Close those gaps so the
 * reading reads like a sentence rather than a token dump.
 */
const readingFor = (text: string): string =>
  pinyin(text, { toneType: 'symbol', type: 'string' })
    .replace(/\s+([，。！？、；：·»）】》])/g, '$1')
    .replace(/([（【《«])\s+/g, '$1')
    .trim();
/** Tatoeba writes SQL-style \N for a missing value. */
const nullable = (s: string | undefined): string | null => (!s || s === '\\N' ? null : s);

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

/** Which pack words appear in this sentence. zh scans substrings; others tokenise. */
function wordsIn(text: string, lang: string, forms: Map<string, string[]>): string[] {
  const hits = new Set<string>();
  if (lang === 'zh') {
    const chars = [...text];
    for (let i = 0; i < chars.length; i++) {
      if (!isHan(chars[i]!)) continue;
      // CC-CEDICT headwords are overwhelmingly 1–4 characters.
      for (let n = 1; n <= 4 && i + n <= chars.length; n++) {
        const ids = forms.get(chars.slice(i, i + n).join(''));
        if (ids) for (const id of ids) hits.add(id);
      }
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

  // --- english pass: collect translation texts AND the EN example candidates ------------
  const engText = new Map<string, string>();
  const candidates: Record<string, Candidate[]> = { zh: [], fr: [], en: [] };
  for await (const line of bz2Lines(files['eng']!)) {
    const [id, , text, username] = line.split('\t');
    if (!id || !text) continue;
    if (neededEng.has(id)) engText.set(id, text);
    if (text.length <= MAX_LEN && isUsable(text, 'en'))
      candidates['en']!.push({ nativeId: id, text, username: nullable(username) });
  }
  console.log(`  english: ${engText.size} translations resolved, ${candidates['en']!.length} EN candidates`);

  // --- cmn / fra candidates -------------------------------------------------------------
  for (const l of LANGS.filter((x) => x.needsTranslation)) {
    for await (const line of bz2Lines(files[l.tatoeba]!)) {
      const [id, , text, username] = line.split('\t');
      if (!id || !text || text.length > MAX_LEN || !isUsable(text, l.pack)) continue;
      if (!engText.has(linkTo.get(`${l.tatoeba}:${id}`) ?? '')) continue; // untranslated ⇒ unusable
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
          reading: l.pack === 'zh' ? readingFor(c.text) : null,
          attribution: `sentence #${c.nativeId}${c.username ? ` by ${c.username}` : ''}, CC BY 2.0 FR`,
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
