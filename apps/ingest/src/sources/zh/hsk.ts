/**
 * seed:zh-hsk — drkameleon/complete-hsk-vocabulary (MIT): merged HSK 2.0 + 3.0 lists.
 * Sets words.level on matching CC-CEDICT entries (match: simplified|traditional|pinyin key,
 * fallback simplified+traditional). Creates zh:w:hsk:* rows for the rare words CEDICT lacks.
 * Level tags: new-N = HSK 3.0 (GF0025-2021), newest-N = later 3.0 revision, old-N = HSK 2.0.
 * Priority: new > newest > old; N=7 → 'HSK7-9'.
 */
import { readFileSync } from 'node:fs';
import { wordId } from '@mls/shared';
import { download, sha256File } from '../../lib/download';
import { pinyinKey } from '../../lib/pinyin';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'hsk';
const URL = 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.json';

interface HskEntry {
  simplified: string;
  level: string[];
  frequency: number;
  pos: string[];
  forms: { traditional: string; transcriptions: { pinyin: string; numeric: string }; meanings: string[] }[];
}

function toLevel(tags: string[]): string | null {
  for (const prefix of ['new-', 'newest-', 'old-']) {
    const tag = tags.find((t) => t.startsWith(prefix));
    if (tag) {
      const n = Number(tag.slice(prefix.length));
      if (n >= 1 && n <= 6) return `HSK${n}`;
      if (n >= 7) return 'HSK7-9';
    }
  }
  return null;
}

export async function run(db: DB): Promise<void> {
  const path = await download({
    id: 'hsk:complete.json',
    url: URL,
    relPath: 'zh/hsk-complete.json',
    license: 'MIT (repo); HSK lists are PRC national standard data (GF0025-2021)',
  });
  const inputSha = sha256File(path);
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ hsk unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'Complete HSK Vocabulary',
    url: 'https://github.com/drkameleon/complete-hsk-vocabulary',
    license: 'MIT',
    licenseUrl: 'https://github.com/drkameleon/complete-hsk-vocabulary/blob/main/LICENSE',
    attributionText:
      'HSK 2.0/3.0 level data from complete-hsk-vocabulary by Yanis Zafirópulos (MIT). HSK word lists are PRC national standard data (GF0025-2021).',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  const entries = JSON.parse(readFileSync(path, 'utf8')) as HskEntry[];

  const byId = db.prepare(`SELECT id FROM words WHERE id = ?`);
  const bySimpTrad = db.prepare(`SELECT id FROM words WHERE lang = 'zh' AND headword = ? AND alt_form = ?`);
  const setLevel = db.prepare(`UPDATE words SET level = ? WHERE id = ?`);
  const insertWord = db.prepare(`
    INSERT INTO words (id, lang, headword, alt_form, reading, freq_rank, level, sv_cognate, source_id, extra)
    VALUES (@id, 'zh', @headword, @alt_form, @reading, NULL, @level, NULL, '${SOURCE_ID}', NULL)
    ON CONFLICT(id) DO UPDATE SET level = excluded.level`);
  const insertSense = db.prepare(`
    INSERT INTO senses (word_id, ord, pos, gloss_en, gloss_vi, examples, source_id)
    VALUES (@word_id, 0, NULL, @gloss_en, NULL, NULL, '${SOURCE_ID}')
    ON CONFLICT(word_id, ord) DO UPDATE SET gloss_en = excluded.gloss_en`);

  let matched = 0;
  let created = 0;
  let skipped = 0;

  db.transaction(() => {
    for (const e of entries) {
      const level = toLevel(e.level);
      if (!level) { skipped++; continue; }
      const form = e.forms[0];
      if (!form) { skipped++; continue; }

      const exactId = wordId('zh', 'cedict', e.simplified, `${form.traditional}|${pinyinKey(form.transcriptions.numeric)}`);
      if (byId.get(exactId)) {
        setLevel.run(level, exactId);
        matched++;
        continue;
      }
      const candidates = bySimpTrad.all(e.simplified, form.traditional) as { id: string }[];
      if (candidates.length >= 1) {
        // homograph readings all get the level — HSK lists don't distinguish them
        for (const c of candidates) setLevel.run(level, c.id);
        matched++;
        continue;
      }
      // Not in CEDICT (rare): create a minimal word from the HSK data itself.
      const id = wordId('zh', SOURCE_ID, e.simplified, pinyinKey(form.transcriptions.numeric));
      insertWord.run({
        id,
        headword: e.simplified,
        alt_form: form.traditional,
        reading: form.transcriptions.pinyin,
        level,
      });
      insertSense.run({ word_id: id, gloss_en: form.meanings.join('; ') });
      created++;
    }
  })();

  recordRun(db, SOURCE_ID, matched + created, inputSha);
  console.log(`  ✓ hsk: ${matched} levels set on CEDICT words, ${created} words created, ${skipped} skipped (no level/form)`);
}
