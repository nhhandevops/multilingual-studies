/**
 * seed:freq — hermitdave/FrequencyWords (CC BY-SA 4.0), OpenSubtitles 2018:
 * frequency ranks for en and zh. (fr keeps its Lexique-derived rank — better register mix.)
 * Format: `word count` per line; rank = line number.
 */
import { download, sha256File } from '../../lib/download';
import { lines } from '../../lib/text';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'freq-hermitdave';
const FILES = [
  { lang: 'en', url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt', rel: 'shared/freq-en_50k.txt' },
  { lang: 'zh', url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/zh_cn/zh_cn_50k.txt', rel: 'shared/freq-zh_cn_50k.txt' },
] as const;

export async function run(db: DB): Promise<void> {
  const paths: { lang: string; path: string }[] = [];
  for (const f of FILES) {
    paths.push({
      lang: f.lang,
      path: await download({ id: `freq:${f.rel}`, url: f.url, relPath: f.rel, license: 'CC BY-SA 4.0' }),
    });
  }
  const inputSha = paths.map((p) => sha256File(p.path)).join('');
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ freq unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'FrequencyWords (OpenSubtitles 2018)',
    url: 'https://github.com/hermitdave/FrequencyWords',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attributionText: 'Word frequency ranks from FrequencyWords by Hermit Dave (OpenSubtitles 2018 corpus), CC BY-SA 4.0.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  let updated = 0;
  for (const { lang, path } of paths) {
    // headword (en: lowercase) → all word ids in that language (zh homographs share a rank)
    const index = new Map<string, string[]>();
    for (const row of db.prepare(`SELECT id, headword FROM words WHERE lang = ?`).all(lang) as { id: string; headword: string }[]) {
      const key = lang === 'en' ? row.headword.toLowerCase() : row.headword;
      const list = index.get(key) ?? [];
      list.push(row.id);
      index.set(key, list);
    }

    const setRank = db.prepare(`UPDATE words SET freq_rank = ? WHERE id = ? AND (freq_rank IS NULL OR freq_rank > ?)`);
    let rank = 0;
    let n = 0;
    const pairs: [number, string][] = [];
    for await (const line of lines(path)) {
      rank++;
      const word = line.split(' ')[0]!;
      const ids = index.get(lang === 'en' ? word.toLowerCase() : word);
      if (!ids) continue;
      for (const id of ids) pairs.push([rank, id]);
    }
    db.transaction(() => {
      for (const [r, id] of pairs) {
        setRank.run(r, id, r);
        n++;
      }
    })();
    updated += n;
    console.log(`  · freq ${lang}: ${n} ranks set`);
  }

  recordRun(db, SOURCE_ID, updated, inputSha);
  console.log(`  ✓ freq: ${updated} frequency ranks`);
}
