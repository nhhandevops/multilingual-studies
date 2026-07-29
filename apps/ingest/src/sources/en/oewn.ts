/**
 * seed:en-oewn — Open English WordNet 2024 (CC BY 4.0): glosses, POS, examples
 * for the English backbone words (created by seed:en-cefrj — run that first).
 * Streams the WN-LMF XML (line-regular): LexicalEntry blocks first, then Synsets.
 */
import { download, sha256File } from '../../lib/download';
import { decodeXml, lines } from '../../lib/text';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'oewn';
const URL = 'https://en-word.net/downloads/english-wordnet-2024.xml.gz';
const MAX_SENSES_PER_WORD = 5;
const MAX_EXAMPLES = 2;

const POS_NAME: Record<string, string> = { n: 'noun', v: 'verb', a: 'adjective', s: 'adjective', r: 'adverb' };

export async function run(db: DB): Promise<void> {
  const path = await download({
    id: 'oewn:english-wordnet-2024.xml.gz',
    url: URL,
    relPath: 'en/english-wordnet-2024.xml.gz',
    license: 'CC BY 4.0',
  });
  const inputSha = sha256File(path);
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ oewn unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'Open English WordNet',
    url: 'https://en-word.net/',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attributionText: 'English definitions and examples from Open English WordNet 2024, CC BY 4.0.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  // backbone lemma (lowercase) → word_id
  const backbone = new Map<string, string>();
  for (const row of db.prepare(`SELECT id, headword FROM words WHERE lang = 'en'`).all() as { id: string; headword: string }[]) {
    backbone.set(row.headword.toLowerCase(), row.id);
  }

  // Pass 1 (streaming): entry lemma/senses, then synset definitions for needed ids.
  const wordSynsets = new Map<string, { pos: string; synset: string }[]>(); // word_id → refs
  const neededSynsets = new Set<string>();
  const synsetDef = new Map<string, { def: string; examples: string[] }>();

  let currentLemma: { wordIdStr: string; pos: string } | null = null;
  let currentSynset: string | null = null;

  for await (const line of lines(path)) {
    const lemma = /<Lemma writtenForm="([^"]*)" partOfSpeech="([^"]*)"/.exec(line);
    if (lemma) {
      const idStr = backbone.get(decodeXml(lemma[1]!).toLowerCase());
      currentLemma = idStr ? { wordIdStr: idStr, pos: lemma[2]! } : null;
      continue;
    }
    if (currentLemma && line.includes('<Sense ')) {
      const syn = /synset="([^"]*)"/.exec(line);
      if (syn) {
        const list = wordSynsets.get(currentLemma.wordIdStr) ?? [];
        if (list.length < MAX_SENSES_PER_WORD * 2) {
          list.push({ pos: currentLemma.pos, synset: syn[1]! });
          wordSynsets.set(currentLemma.wordIdStr, list);
          neededSynsets.add(syn[1]!);
        }
      }
      continue;
    }
    if (line.includes('</LexicalEntry>')) { currentLemma = null; continue; }

    const synOpen = /<Synset id="([^"]*)"/.exec(line);
    if (synOpen) {
      currentSynset = neededSynsets.has(synOpen[1]!) ? synOpen[1]! : null;
      continue;
    }
    if (currentSynset) {
      const def = /<Definition>(.*)<\/Definition>/.exec(line);
      if (def) {
        const entry = synsetDef.get(currentSynset) ?? { def: '', examples: [] };
        if (!entry.def) entry.def = decodeXml(def[1]!);
        synsetDef.set(currentSynset, entry);
        continue;
      }
      const ex = /<Example>(.*)<\/Example>/.exec(line);
      if (ex) {
        const entry = synsetDef.get(currentSynset);
        if (entry && entry.examples.length < MAX_EXAMPLES) entry.examples.push(decodeXml(ex[1]!));
        continue;
      }
      if (line.includes('</Synset>')) currentSynset = null;
    }
  }

  const deleteSenses = db.prepare(`DELETE FROM senses WHERE word_id = ? AND source_id = '${SOURCE_ID}'`);
  const insertSense = db.prepare(`
    INSERT INTO senses (word_id, ord, pos, gloss_en, gloss_vi, examples, source_id)
    VALUES (@word_id, @ord, @pos, @gloss_en, NULL, @examples, '${SOURCE_ID}')
    ON CONFLICT(word_id, ord) DO UPDATE SET
      pos = excluded.pos, gloss_en = excluded.gloss_en, examples = excluded.examples`);

  let words = 0;
  let senses = 0;
  db.transaction(() => {
    for (const [wid, refs] of wordSynsets) {
      deleteSenses.run(wid);
      let ord = 0;
      for (const ref of refs) {
        if (ord >= MAX_SENSES_PER_WORD) break;
        const syn = synsetDef.get(ref.synset);
        if (!syn?.def) continue;
        insertSense.run({
          word_id: wid,
          ord,
          pos: POS_NAME[ref.pos] ?? ref.pos,
          gloss_en: syn.def,
          examples: syn.examples.length ? JSON.stringify(syn.examples) : null,
        });
        ord++;
        senses++;
      }
      if (ord > 0) words++;
    }
  })();

  recordRun(db, SOURCE_ID, senses, inputSha);
  console.log(`  ✓ oewn: ${senses} senses for ${words}/${backbone.size} backbone words`);
}
