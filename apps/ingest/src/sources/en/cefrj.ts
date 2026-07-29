/**
 * seed:en-cefrj — the English word backbone with CEFR levels.
 *  - CEFR-J Vocabulary Profile 1.5 (Tono Lab, TUFS): ~7,800 words A1–B2.
 *    License: free for research AND commercial use with citation (verified in repo README).
 *  - Octanove Vocabulary Profile C1/C2 1.0 (CC BY-SA 4.0).
 * One word row per headword; per-POS levels kept in extra.pos_levels; word level = easiest.
 */
import { readFileSync } from 'node:fs';
import { wordId } from '@mls/shared';
import { download, sha256File } from '../../lib/download';
import { minCefr, splitCsv } from '../../lib/text';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const CEFRJ_URL = 'https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv';
const OCTANOVE_URL = 'https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/octanove-vocabulary-profile-c1c2-1.0.csv';

export async function run(db: DB): Promise<void> {
  const cefrjPath = await download({
    id: 'cefrj:vocabulary-profile-1.5.csv',
    url: CEFRJ_URL,
    relPath: 'en/cefrj-vocabulary-profile-1.5.csv',
    license: 'Free for research and commercial use with citation (CEFR-J, Tono Lab TUFS)',
  });
  const octanovePath = await download({
    id: 'octanove:vocabulary-profile-c1c2-1.0.csv',
    url: OCTANOVE_URL,
    relPath: 'en/octanove-vocabulary-profile-c1c2-1.0.csv',
    license: 'CC BY-SA 4.0',
  });
  const inputSha = sha256File(cefrjPath) + sha256File(octanovePath);
  if (alreadyIngested(db, 'cefrj', inputSha)) {
    console.log('  ✓ cefrj/octanove unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: 'cefrj',
    name: 'CEFR-J Vocabulary Profile',
    url: 'https://github.com/openlanguageprofiles/olp-en-cefrj',
    license: 'Free for research/commercial use with citation',
    licenseUrl: 'https://github.com/openlanguageprofiles/olp-en-cefrj#readme',
    attributionText:
      'CEFR levels from the CEFR-J Vocabulary Profile (© Tono Lab, Tokyo University of Foreign Studies), distributed via Open Language Profiles.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });
  registerSource(db, {
    id: 'octanove',
    name: 'Octanove Vocabulary Profile C1/C2',
    url: 'https://github.com/openlanguageprofiles/olp-en-cefrj',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attributionText: 'C1/C2 vocabulary from the Octanove Vocabulary Profile (Octanove Labs), CC BY-SA 4.0.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  interface Acc { level: string; posLevels: { pos: string; level: string }[]; sourceId: string }
  const acc = new Map<string, Acc>();
  const accDisplay = new Map<string, string>();

  const ingestCsv = (path: string, sourceId: string) => {
    const rows = readFileSync(path, 'utf8').split('\n');
    for (const line of rows.slice(1)) {
      if (!line.trim()) continue;
      const [headwordRaw, pos, cefrRaw] = splitCsv(line);
      if (!headwordRaw || !cefrRaw) continue;
      // 'a.m./A.M./am/AM' → first variant is the canonical display form
      const headword = headwordRaw.split('/')[0]!.trim();
      const level = cefrRaw.trim().replace(/\?$/, ''); // a handful are marked 'B2?' — take the level
      if (!/^(A1|A2|B1|B2|C1|C2)$/.test(level) || !headword) continue;
      const existing = acc.get(headword.toLowerCase());
      if (existing) {
        existing.level = minCefr(existing.level, level);
        existing.posLevels.push({ pos: pos ?? '', level });
      } else {
        acc.set(headword.toLowerCase(), {
          level,
          posLevels: [{ pos: pos ?? '', level }],
          sourceId,
        });
        accDisplay.set(headword.toLowerCase(), headword);
      }
    }
  };
  ingestCsv(cefrjPath, 'cefrj');
  ingestCsv(octanovePath, 'octanove');

  const insert = db.prepare(`
    INSERT INTO words (id, lang, headword, alt_form, reading, freq_rank, level, sv_cognate, source_id, extra)
    VALUES (@id, 'en', @headword, NULL, NULL, NULL, @level, NULL, @source_id, @extra)
    ON CONFLICT(id) DO UPDATE SET level = excluded.level, extra = excluded.extra`);

  let n = 0;
  db.transaction(() => {
    for (const [lower, a] of acc) {
      const headword = accDisplay.get(lower)!;
      insert.run({
        id: wordId('en', 'cefrj', headword),
        headword,
        level: a.level,
        source_id: a.sourceId,
        extra: JSON.stringify({ pos_levels: a.posLevels }),
      });
      n++;
    }
  })();

  recordRun(db, 'cefrj', n, inputSha);
  console.log(`  ✓ cefrj+octanove: ${n} English words with CEFR levels`);
}
