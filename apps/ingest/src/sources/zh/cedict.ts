/**
 * seed:zh-cedict — CC-CEDICT (via MDBG export), the Chinese dictionary backbone.
 * License: CC BY-SA 4.0 (verified 2026-07-29, docs/RESEARCH-SOURCES.md).
 * Format: `Traditional Simplified [pin1 yin1] /gloss 1/gloss 2/`
 * ID scheme: zh:w:cedict:{simp}|{trad}|{pinyinKey} — one word per reading (好|好|hao3 ≠ 好|好|hao4).
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { wordId } from '@mls/shared';
import { download, sha256File } from '../../lib/download';
import { numberedToMarked, pinyinKey } from '../../lib/pinyin';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'cedict';
const URL_GZ = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz';

const LINE_RE = /^(\S+)\s(\S+)\s\[([^\]]*)\]\s\/(.+)\/\s*$/;

interface Entry {
  trad: string;
  simp: string;
  pinyinNumbered: string;
  glosses: string[];
}

export function parseCedictLine(line: string): Entry | null {
  if (line.startsWith('#') || line.trim() === '') return null;
  const m = LINE_RE.exec(line);
  if (!m) return null;
  return { trad: m[1]!, simp: m[2]!, pinyinNumbered: m[3]!, glosses: m[4]!.split('/').filter(Boolean) };
}

export async function run(db: DB): Promise<void> {
  const path = await download({
    id: 'cedict:cedict_1_0_ts_utf-8_mdbg.txt.gz',
    url: URL_GZ,
    relPath: 'zh/cedict_1_0_ts_utf-8_mdbg.txt.gz',
    license: 'CC BY-SA 4.0',
    notes: 'CC-CEDICT dictionary export from MDBG; updated near-daily upstream',
  });
  const inputSha = sha256File(path);
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ cedict unchanged, skipping (delete cache file to force)');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'CC-CEDICT',
    url: 'https://www.mdbg.net/chinese/dictionary?page=cc-cedict',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attributionText:
      'Chinese dictionary data from CC-CEDICT (https://cc-cedict.org), distributed by MDBG, licensed under CC BY-SA 4.0.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  const text = gunzipSync(readFileSync(path)).toString('utf8');

  // Aggregate by ID first: rare duplicate (simp,trad,pinyin) lines merge their glosses.
  const byId = new Map<string, Entry & { id: string }>();
  for (const line of text.split('\n')) {
    const e = parseCedictLine(line);
    if (!e) continue;
    const id = wordId('zh', SOURCE_ID, e.simp, `${e.trad}|${pinyinKey(e.pinyinNumbered)}`);
    const existing = byId.get(id);
    if (existing) existing.glosses.push(...e.glosses);
    else byId.set(id, { ...e, id });
  }

  const upsertWord = db.prepare(`
    INSERT INTO words (id, lang, headword, alt_form, reading, freq_rank, level, sv_cognate, source_id, extra)
    VALUES (@id, 'zh', @headword, @alt_form, @reading, NULL, NULL, NULL, '${SOURCE_ID}', NULL)
    ON CONFLICT(id) DO UPDATE SET
      headword = excluded.headword, alt_form = excluded.alt_form, reading = excluded.reading`);
  const deleteSenses = db.prepare(`DELETE FROM senses WHERE word_id = ? AND source_id = '${SOURCE_ID}'`);
  const insertSense = db.prepare(`
    INSERT INTO senses (word_id, ord, pos, gloss_en, gloss_vi, examples, source_id)
    VALUES (@word_id, @ord, NULL, @gloss_en, NULL, NULL, '${SOURCE_ID}')
    ON CONFLICT(word_id, ord) DO UPDATE SET gloss_en = excluded.gloss_en`);

  let n = 0;
  db.transaction(() => {
    for (const e of byId.values()) {
      upsertWord.run({
        id: e.id,
        headword: e.simp,
        alt_form: e.trad,
        reading: numberedToMarked(e.pinyinNumbered),
      });
      deleteSenses.run(e.id);
      insertSense.run({
        word_id: e.id,
        ord: 0,
        gloss_en: e.glosses.join('; '),
      });
      n++;
    }
  })();

  recordRun(db, SOURCE_ID, n, inputSha);
  console.log(`  ✓ cedict: ${n} words upserted`);
}
