/**
 * seed:zh-strokes — makemeahanzi stroke data → `graphemes` (kind='hanzi').
 *
 * Two upstream files, two licenses, two `sources` rows, two tables — deliberately:
 *   graphics.txt   Arphic Public License  → graphemes.stroke_json  (source 'mmah')
 *   dictionary.txt LGPL-3.0-or-later      → hanzi_info             (source 'mmah-dict')
 * The APL requires shipping its unaltered text, so ARPHICPL.TXT is written into
 * apps/web/public/licenses/ (committed) and linked from the Licenses screen.
 *
 * Coverage is intersected with the characters that actually occur in our zh words —
 * graphics.txt carries ~9.5k glyphs including rare radicals we have no content for.
 * `graphemes.reading` comes from CC-CEDICT single-character entries (already bundled,
 * CC BY-SA) rather than dictionary.txt, so the APL table stays free of LGPL data.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { graphemeId } from '@mls/shared';
import { download, sha256File } from '../../lib/download';
import { REPO_ROOT } from '../../lib/paths';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const GRAPHICS_SOURCE = 'mmah';
const DICT_SOURCE = 'mmah-dict';
const REPO = 'https://github.com/skishore/makemeahanzi';
const RAW = 'https://raw.githubusercontent.com/skishore/makemeahanzi/master';
// The APL text itself lives in a *directory* in makemeahanzi; hanzi-writer-data ships the
// same license as one file, which is the shape we need to redistribute.
const APL_URL = 'https://raw.githubusercontent.com/chanind/hanzi-writer-data/master/ARPHICPL.TXT';
const APL_DEST = join(REPO_ROOT, 'apps', 'web', 'public', 'licenses', 'ARPHICPL.TXT');

interface GraphicsLine {
  character: string;
  strokes: string[];
  medians: number[][][];
}

interface DictLine {
  character: string;
  definition?: string;
  pinyin?: string[];
  decomposition?: string;
  radical?: string;
  etymology?: { type?: string; hint?: string; phonetic?: string; semantic?: string };
}

const isHan = (ch: string): boolean => /\p{Script=Han}/u.test(ch);

/** Every Han character occurring in a zh headword or traditional variant. */
function charsInContent(db: DB): Set<string> {
  const set = new Set<string>();
  for (const row of db.prepare(`SELECT headword, alt_form FROM words WHERE lang = 'zh'`).all() as {
    headword: string;
    alt_form: string | null;
  }[]) {
    for (const form of [row.headword, row.alt_form]) {
      if (!form) continue;
      for (const ch of form) if (isHan(ch)) set.add(ch);
    }
  }
  return set;
}

/** Pinyin for single-character CEDICT entries, best (lowest) freq_rank first, max 3. */
function readingsFromCedict(db: DB): Map<string, string> {
  const out = new Map<string, string>();
  const rows = db
    .prepare(
      `SELECT headword, reading FROM words
        WHERE lang = 'zh' AND reading IS NOT NULL AND length(headword) = 1
        ORDER BY freq_rank IS NULL, freq_rank`,
    )
    .all() as { headword: string; reading: string }[];
  const seen = new Map<string, Set<string>>();
  for (const r of rows) {
    let readings = seen.get(r.headword);
    if (!readings) seen.set(r.headword, (readings = new Set()));
    if (readings.size >= 3) continue;
    readings.add(r.reading);
  }
  for (const [ch, readings] of seen) out.set(ch, [...readings].join(' / '));
  return out;
}

function* jsonLines<T>(path: string): Generator<T> {
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed) yield JSON.parse(trimmed) as T;
  }
}

export async function run(db: DB): Promise<void> {
  const graphicsPath = await download({
    id: 'mmah:graphics.txt',
    url: `${RAW}/graphics.txt`,
    relPath: 'zh/mmah-graphics.txt',
    license: 'Arphic Public License (derived from Arphic PL KaitiM GB / PL UKai fonts)',
    notes: 'stroke outlines + medians, one JSON object per line',
  });
  const dictPath = await download({
    id: 'mmah:dictionary.txt',
    url: `${RAW}/dictionary.txt`,
    relPath: 'zh/mmah-dictionary.txt',
    license: 'LGPL-3.0-or-later (derived from Unihan + CJKlib)',
    notes: 'decomposition / radical / etymology; kept in its own table to stay LGPL-separable',
  });
  const aplPath = await download({
    id: 'mmah:ARPHICPL.TXT',
    url: APL_URL,
    relPath: 'zh/ARPHICPL.TXT',
    license: 'Arphic Public License (the license text itself — redistribution is required by it)',
  });

  // Redistributing the unaltered APL text is a condition of the license, so it ships as a
  // static asset rather than only existing in the (gitignored) download cache.
  mkdirSync(join(REPO_ROOT, 'apps', 'web', 'public', 'licenses'), { recursive: true });
  writeFileSync(APL_DEST, readFileSync(aplPath));

  const inputSha = sha256File(graphicsPath) + sha256File(dictPath);
  if (alreadyIngested(db, GRAPHICS_SOURCE, inputSha)) {
    console.log('  ✓ zh-strokes unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: GRAPHICS_SOURCE,
    name: 'Make Me a Hanzi (stroke graphics)',
    url: REPO,
    license: 'Arphic Public License',
    licenseUrl: '/licenses/ARPHICPL.TXT',
    attributionText:
      'Character stroke data from Make Me a Hanzi by Shaunak Kishore, derived from the Arphic PL KaitiM GB and Arphic PL UKai fonts by Arphic Technology Co., Ltd. Used under the Arphic Public License; the unaltered license text ships with this app.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });
  registerSource(db, {
    id: DICT_SOURCE,
    name: 'Make Me a Hanzi (character dictionary)',
    url: REPO,
    license: 'LGPL-3.0-or-later',
    licenseUrl: 'https://www.gnu.org/licenses/lgpl-3.0.html',
    attributionText:
      'Character decomposition, radical and etymology data from Make Me a Hanzi dictionary.txt (LGPL-3.0-or-later), derived from the Unicode Unihan database and CJKlib.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  const wanted = charsInContent(db);
  const readings = readingsFromCedict(db);

  const insertGrapheme = db.prepare(`
    INSERT INTO graphemes (id, lang, glyph, kind, reading, ipa, stroke_json, diagram_ref, audio_id, ord, notes_md, source_id)
    VALUES (@id, 'zh', @glyph, 'hanzi', @reading, NULL, @stroke_json, NULL, NULL, @ord, NULL, '${GRAPHICS_SOURCE}')
    ON CONFLICT(id) DO UPDATE SET
      reading = excluded.reading, stroke_json = excluded.stroke_json, ord = excluded.ord`);
  const insertInfo = db.prepare(`
    INSERT INTO hanzi_info (grapheme_id, character, definition, pinyin, decomposition, radical, etymology, source_id)
    VALUES (@grapheme_id, @character, @definition, @pinyin, @decomposition, @radical, @etymology, '${DICT_SOURCE}')
    ON CONFLICT(grapheme_id) DO UPDATE SET
      definition = excluded.definition, pinyin = excluded.pinyin,
      decomposition = excluded.decomposition, radical = excluded.radical, etymology = excluded.etymology`);

  const ingested = new Set<string>();
  let skippedNoContent = 0;
  let malformed = 0;

  db.transaction(() => {
    for (const g of jsonLines<GraphicsLine>(graphicsPath)) {
      if (!wanted.has(g.character)) { skippedNoContent++; continue; }
      if (!Array.isArray(g.strokes) || g.strokes.length === 0) { malformed++; continue; }
      const id = graphemeId('zh', GRAPHICS_SOURCE, g.character);
      insertGrapheme.run({
        id,
        glyph: g.character,
        reading: readings.get(g.character) ?? null,
        // Exactly the shape hanzi-writer's renderer expects — no re-encoding.
        stroke_json: JSON.stringify({ strokes: g.strokes, medians: g.medians }),
        ord: g.strokes.length, //  stroke count doubles as the browse-by-strokes sort key
      });
      ingested.add(g.character);
    }
  })();

  let infoRows = 0;
  db.transaction(() => {
    for (const d of jsonLines<DictLine>(dictPath)) {
      if (!ingested.has(d.character)) continue; //  no stroke row ⇒ no FK target
      insertInfo.run({
        grapheme_id: graphemeId('zh', GRAPHICS_SOURCE, d.character),
        character: d.character,
        definition: d.definition ?? null,
        pinyin: d.pinyin && d.pinyin.length > 0 ? JSON.stringify(d.pinyin) : null,
        // '？' is upstream's "unknown" marker, not a decomposition.
        decomposition: d.decomposition && d.decomposition !== '？' ? d.decomposition : null,
        radical: d.radical ?? null,
        etymology: d.etymology ? JSON.stringify(d.etymology) : null,
      });
      infoRows++;
    }
  })();

  recordRun(db, GRAPHICS_SOURCE, ingested.size, inputSha);
  recordRun(db, DICT_SOURCE, infoRows, inputSha);

  const missing = [...wanted].filter((ch) => !ingested.has(ch)).length;
  console.log(`  ✓ zh-strokes: ${ingested.size} hanzi with stroke data, ${infoRows} dictionary rows`);
  console.log(`    skipped ${skippedNoContent} upstream glyphs with no word content${malformed ? `, ${malformed} malformed` : ''}`);
  console.log(`    ${missing} of ${wanted.size} content characters have NO stroke data upstream`);
  console.log(`    ARPHICPL.TXT → apps/web/public/licenses/ARPHICPL.TXT (must stay committed)`);
}
