/**
 * seed:fr-lexique — Lexique 3.83 (New & Pallier, CC BY-SA 4.0): the French backbone.
 *  - Top 15,000 lemmas ranked by combined film-subtitle + book frequency.
 *  - reading = phonemic transcription converted from Lexique's code to IPA
 *    (later refined by seed:fr-kaikki-en where Wiktionary has real IPA).
 *  - CEFR bands DERIVED here — no redistributable French CEFR list exists (research 2026-07-29).
 *    Method: frequency-rank cutoffs at the Milton & Alexiou (2009) vocabulary-size anchors
 *    (~1k/2k/3k/3.75k/4.5k/5k lemmas for A1→C2), following the FLELex first-occurrence
 *    methodology (François et al., LREC 2014) in spirit. Beyond 5k: ungraded.
 */
import { wordId } from '@mls/shared';
import { download, sha256File } from '../../lib/download';
import { lines } from '../../lib/text';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'lexique';
// http on purpose: www.lexique.org TLS cert is misconfigured (verified 2026-07-29)
const URL = 'http://www.lexique.org/databases/Lexique383/Lexique383.tsv';
const BACKBONE_SIZE = 15_000;
const CEFR_CUTOFFS: [number, string][] = [
  [1_000, 'A1'], [2_000, 'A2'], [3_000, 'B1'], [3_750, 'B2'], [4_500, 'C1'], [5_000, 'C2'],
];

/** Lexique 3 phonemic code → IPA (vowels/nasals/semivowels/consonants that differ). */
const PHON_TO_IPA: Record<string, string> = {
  E: 'ɛ', O: 'ɔ', '°': 'ə', '2': 'ø', '9': 'œ',
  '5': 'ɛ̃', '1': 'œ̃', '@': 'ɑ̃', '§': 'ɔ̃',
  '8': 'ɥ', S: 'ʃ', Z: 'ʒ', N: 'ɲ', G: 'ŋ', R: 'ʁ',
};
const phonToIpa = (phon: string): string => [...phon].map((c) => PHON_TO_IPA[c] ?? c).join('');

const WORD_SHAPE = /^[a-zàâäéèêëîïôöùûüÿçœæ' -]+$/i;

export async function run(db: DB): Promise<void> {
  const path = await download({
    id: 'lexique:Lexique383.tsv',
    url: URL,
    relPath: 'fr/Lexique383.tsv',
    license: 'CC BY-SA 4.0',
    notes: 'New & Pallier, Lexique 3.83 — mirror: github.com/chrplr/openlexicon',
  });
  const inputSha = sha256File(path);
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ lexique unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'Lexique 3.83',
    url: 'http://www.lexique.org/',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attributionText:
      'French word frequencies and phonology from Lexique 3.83 (Boris New & Christophe Pallier), CC BY-SA 4.0. CEFR bands derived from frequency ranks at Milton & Alexiou (2009) anchors.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  interface Acc { freq: number; phon: string; gender: string | null; pos: Set<string> }
  const acc = new Map<string, Acc>();

  let header: string[] | null = null;
  let col: Record<string, number> = {};
  for await (const line of lines(path)) {
    if (!header) {
      header = line.split('\t');
      col = Object.fromEntries(header.map((h, i) => [h, i]));
      continue;
    }
    const f = line.split('\t');
    if (f.length < header.length) continue;
    if (f[col['islem']!] !== '1') continue; // lemma rows only
    const lemme = f[col['lemme']!]!;
    if (!WORD_SHAPE.test(lemme) || lemme.length < 2) continue;
    const cgram = f[col['cgram']!]!;
    if (cgram === 'NOM_sup' || cgram === '') continue;
    const freq = (Number(f[col['freqlemfilms2']!]) || 0) + (Number(f[col['freqlemlivres']!]) || 0);
    const genre = f[col['genre']!] || null;
    const phon = f[col['phon']!] ?? '';
    const existing = acc.get(lemme);
    if (existing) {
      existing.freq = Math.max(existing.freq, freq);
      existing.pos.add(cgram);
      if (!existing.gender && genre) existing.gender = genre;
    } else {
      acc.set(lemme, { freq, phon, gender: genre, pos: new Set([cgram]) });
    }
  }

  const ranked = [...acc.entries()].sort((a, b) => b[1].freq - a[1].freq).slice(0, BACKBONE_SIZE);

  const insert = db.prepare(`
    INSERT INTO words (id, lang, headword, alt_form, reading, freq_rank, level, sv_cognate, source_id, extra)
    VALUES (@id, 'fr', @headword, NULL, @reading, @freq_rank, @level, NULL, '${SOURCE_ID}', @extra)
    ON CONFLICT(id) DO UPDATE SET
      reading = COALESCE(words.reading, excluded.reading),
      freq_rank = excluded.freq_rank, level = excluded.level, extra = excluded.extra`);

  let n = 0;
  db.transaction(() => {
    ranked.forEach(([lemme, a], i) => {
      const rank = i + 1;
      const level = CEFR_CUTOFFS.find(([cut]) => rank <= cut)?.[1] ?? null;
      insert.run({
        id: wordId('fr', SOURCE_ID, lemme),
        headword: lemme,
        reading: a.phon ? phonToIpa(a.phon) : null,
        freq_rank: rank,
        level,
        extra: JSON.stringify({ gender: a.gender, pos: [...a.pos] }),
      });
      n++;
    });
  })();

  recordRun(db, SOURCE_ID, n, inputSha);
  console.log(`  ✓ lexique: ${n} French lemmas (A1≤1k … C2≤5k, ungraded beyond)`);
}
