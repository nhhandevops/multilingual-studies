/**
 * seed:fr-kaikki-en — kaikki.org French extract FROM ENGLISH Wiktionary (CC BY-SA 4.0 + GFDL):
 * English glosses + real IPA for the French backbone created by seed:fr-lexique (run that first).
 * Streams the 56 MB JSONL.gz line by line; keeps only backbone lemmas; skips pure form-of senses.
 */
import { download, sha256File } from '../../lib/download';
import { lines } from '../../lib/text';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'kaikki-fr-en';
const URL = 'https://kaikki.org/dictionary/French/kaikki.org-dictionary-French.jsonl.gz';
const MAX_SENSES_PER_WORD = 6;
const MAX_PER_POS = 2;
const MAX_EXAMPLES = 2;

interface KaikkiSense {
  glosses?: string[];
  tags?: string[];
  form_of?: unknown[];
  alt_of?: unknown[];
  examples?: { text?: string }[];
}
interface KaikkiEntry {
  word?: string;
  pos?: string;
  senses?: KaikkiSense[];
  sounds?: { ipa?: string }[];
}

export async function run(db: DB): Promise<void> {
  const path = await download({
    id: 'kaikki:dictionary-French.jsonl.gz',
    url: URL,
    relPath: 'fr/kaikki.org-dictionary-French.jsonl.gz',
    license: 'CC BY-SA 4.0 + GFDL (Wiktionary content, wiktextract by Tatu Ylonen)',
  });
  const inputSha = sha256File(path);
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ kaikki-fr-en unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'Wiktionary (French entries, via kaikki.org)',
    url: 'https://kaikki.org/dictionary/French/',
    license: 'CC BY-SA 4.0 + GFDL',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attributionText:
      'French definitions and IPA from Wiktionary (en.wiktionary.org), machine-extracted by Wiktextract/kaikki.org (Tatu Ylonen). CC BY-SA 4.0.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  // backbone lemma (NFC) → word_id
  const backbone = new Map<string, string>();
  for (const row of db.prepare(`SELECT id, headword FROM words WHERE lang = 'fr'`).all() as { id: string; headword: string }[]) {
    backbone.set(row.headword.normalize('NFC'), row.id);
  }

  interface Acc { ipa: string | null; senses: { pos: string; gloss: string; examples: string[] }[]; perPos: Map<string, number> }
  const acc = new Map<string, Acc>();

  let parsed = 0;
  for await (const line of lines(path)) {
    if (!line.startsWith('{')) continue;
    let entry: KaikkiEntry;
    try {
      entry = JSON.parse(line) as KaikkiEntry;
    } catch {
      continue;
    }
    parsed++;
    const wid = entry.word ? backbone.get(entry.word.normalize('NFC')) : undefined;
    if (!wid || !entry.senses) continue;

    const a: Acc = acc.get(wid) ?? { ipa: null, senses: [], perPos: new Map() };
    if (!a.ipa) {
      const ipa = entry.sounds?.find((s) => s.ipa)?.ipa;
      if (ipa) a.ipa = ipa.replace(/^\/|\/$/g, '');
    }
    const pos = entry.pos ?? '';
    for (const sense of entry.senses) {
      if (a.senses.length >= MAX_SENSES_PER_WORD) break;
      if ((a.perPos.get(pos) ?? 0) >= MAX_PER_POS) break;
      if (sense.form_of || sense.alt_of) continue; // inflected/alternative forms, not lemma senses
      const gloss = sense.glosses?.[sense.glosses.length - 1];
      if (!gloss) continue;
      const examples = (sense.examples ?? [])
        .map((e) => e.text)
        .filter((t): t is string => !!t)
        .slice(0, MAX_EXAMPLES);
      a.senses.push({ pos, gloss, examples });
      a.perPos.set(pos, (a.perPos.get(pos) ?? 0) + 1);
    }
    acc.set(wid, a);
  }

  const setReading = db.prepare(`UPDATE words SET reading = ? WHERE id = ?`);
  const deleteSenses = db.prepare(`DELETE FROM senses WHERE word_id = ? AND source_id = '${SOURCE_ID}'`);
  const insertSense = db.prepare(`
    INSERT INTO senses (word_id, ord, pos, gloss_en, gloss_vi, examples, source_id)
    VALUES (@word_id, @ord, @pos, @gloss_en, NULL, @examples, '${SOURCE_ID}')
    ON CONFLICT(word_id, ord) DO UPDATE SET
      pos = excluded.pos, gloss_en = excluded.gloss_en, examples = excluded.examples`);

  let words = 0;
  let senses = 0;
  db.transaction(() => {
    for (const [wid, a] of acc) {
      if (a.ipa) setReading.run(a.ipa, wid); // Wiktionary IPA beats Lexique phon conversion
      if (a.senses.length === 0) continue;
      deleteSenses.run(wid);
      a.senses.forEach((s, ord) => {
        insertSense.run({
          word_id: wid,
          ord,
          pos: s.pos || null,
          gloss_en: s.gloss,
          examples: s.examples.length ? JSON.stringify(s.examples) : null,
        });
        senses++;
      });
      words++;
    }
  })();

  recordRun(db, SOURCE_ID, senses, inputSha);
  console.log(`  ✓ kaikki-fr-en: ${senses} senses for ${words}/${backbone.size} backbone words (${parsed} entries scanned)`);
}
