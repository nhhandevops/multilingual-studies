/**
 * seed:ipa — ipa-dict (open-dict-data, MIT): word → IPA for en_US and fr_FR.
 * Fills words.reading where still NULL (kaikki IPA, when present, wins — run this last).
 * Format: `word<TAB>/ipa/` (sometimes several comma-separated variants — first one taken).
 */
import { download, sha256File } from '../../lib/download';
import { lines } from '../../lib/text';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'ipa-dict';
const FILES = [
  { lang: 'en', url: 'https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/en_US.txt', rel: 'shared/ipa-en_US.txt' },
  { lang: 'fr', url: 'https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/fr_FR.txt', rel: 'shared/ipa-fr_FR.txt' },
] as const;

export async function run(db: DB): Promise<void> {
  const paths: { lang: string; path: string }[] = [];
  for (const f of FILES) {
    paths.push({
      lang: f.lang,
      path: await download({ id: `ipa-dict:${f.rel}`, url: f.url, relPath: f.rel, license: 'MIT' }),
    });
  }
  const inputSha = paths.map((p) => sha256File(p.path)).join('');
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ ipa-dict unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'ipa-dict',
    url: 'https://github.com/open-dict-data/ipa-dict',
    license: 'MIT',
    licenseUrl: 'https://github.com/open-dict-data/ipa-dict/blob/master/LICENSE.md',
    attributionText: 'IPA transcriptions from ipa-dict (open-dict-data), MIT license.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  let updated = 0;
  for (const { lang, path } of paths) {
    // words still missing a reading, keyed by lowercase headword
    const missing = new Map<string, string>();
    for (const row of db
      .prepare(`SELECT id, headword FROM words WHERE lang = ? AND reading IS NULL`)
      .all(lang) as { id: string; headword: string }[]) {
      missing.set(row.headword.toLowerCase(), row.id);
    }
    if (missing.size === 0) continue;

    const setReading = db.prepare(`UPDATE words SET reading = ? WHERE id = ?`);
    const tx = db.transaction((pairs: [string, string][]) => {
      for (const [reading, id] of pairs) setReading.run(reading, id);
    });
    const pairs: [string, string][] = [];
    for await (const line of lines(path)) {
      const tab = line.indexOf('\t');
      if (tab < 0) continue;
      const id = missing.get(line.slice(0, tab).toLowerCase());
      if (!id) continue;
      const ipa = line.slice(tab + 1).split(',')[0]!.trim().replace(/^\/|\/$/g, '');
      if (!ipa) continue;
      pairs.push([ipa, id]);
      missing.delete(line.slice(0, tab).toLowerCase());
    }
    tx(pairs);
    updated += pairs.length;
    console.log(`  · ipa-dict ${lang}: ${pairs.length} readings filled, ${missing.size} still missing`);
  }

  recordRun(db, SOURCE_ID, updated, inputSha);
  console.log(`  ✓ ipa-dict: ${updated} readings`);
}
