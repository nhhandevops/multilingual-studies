/**
 * seed:zh-word-audio — HSK word pronunciations from hugolpz/audio-cmn (CC BY-SA).
 *
 * Same repository as the pinyin syllable chart but a DIFFERENT speaker and collection
 * (Yue Tan / cmn-caen-tan, vs Chen Wang for the syllables), so it registers its own `sources`
 * row: the attribution has to name the right person.
 *
 * Only recordings that match a word we actually ship AND that carries a level are taken —
 * 8,569 files exist, but audio for a word the learner can't find is dead weight in the pack.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { audioId } from '@mls/shared';
import { recordArtifactSet } from '../../lib/download';
import { DATA_CACHE } from '../../lib/paths';
import { polite } from '../../lib/politeness';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'audio-cmn-hsk';
const REPO = 'https://github.com/hugolpz/audio-cmn';
const DIR = '24k-abr/hsk'; //  same encoding as the syllable chart: one voice quality app-wide
const TREE_API = 'https://api.github.com/repos/hugolpz/audio-cmn/git/trees/master?recursive=1';
const RAW = `https://raw.githubusercontent.com/hugolpz/audio-cmn/master/${DIR}`;
const CACHE = join(DATA_CACHE, 'zh', 'word-audio');
const PARSER_VERSION = 1;

interface TreeEntry { path: string; type: string; size?: number }

/** The contents API caps directory listings at 1,000 — always use the trees API here. */
async function listFiles(): Promise<{ name: string; size: number }[]> {
  const res = await polite(TREE_API, { headers: { accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`audio-cmn tree listing failed: HTTP ${res.status}`);
  const tree = (await res.json()) as { tree?: TreeEntry[]; truncated?: boolean };
  if (!Array.isArray(tree.tree)) throw new Error('audio-cmn tree listing had no tree');
  if (tree.truncated) throw new Error('audio-cmn tree listing was truncated');
  const prefix = `${DIR}/`;
  return tree.tree
    .filter((e) => e.type === 'blob' && e.path.startsWith(prefix) && e.path.endsWith('.mp3'))
    .map((e) => ({ name: e.path.slice(prefix.length), size: e.size ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** `cmn-学习.mp3` → 学习. A few files encode split patterns (`一_也_`) — those are not words. */
function wordOf(fileName: string): string | null {
  const m = /^cmn-(.+)\.mp3$/.exec(fileName);
  if (!m) return null;
  const w = m[1]!;
  return w.includes('_') ? null : w;
}

export async function run(db: DB): Promise<void> {
  const files = await listFiles();
  console.log(`  listing: ${files.length} word recordings in ${DIR}`);

  // Which recordings are worth downloading at all? Match to levelled zh words first, so a
  // fresh machine doesn't pull 36 MB to then discard a third of it.
  const wanted = new Map<string, string[]>(); //  headword → word ids
  for (const r of db
    .prepare(`SELECT id, headword FROM words WHERE lang = 'zh' AND level IS NOT NULL`)
    .all() as { id: string; headword: string }[]) {
    const list = wanted.get(r.headword);
    if (list) list.push(r.id);
    else wanted.set(r.headword, [r.id]);
  }
  const needed = files.filter((f) => {
    const w = wordOf(f.name);
    return w !== null && wanted.has(w);
  });
  console.log(`  ${needed.length} match a levelled word in the pack (${(needed.reduce((a, f) => a + f.size, 0) / 1048576).toFixed(1)} MB)`);

  mkdirSync(CACHE, { recursive: true });
  let fetched = 0;
  let cached = 0;
  for (const f of needed) {
    const dest = join(CACHE, f.name);
    if (existsSync(dest) && statSync(dest).size === f.size) { cached++; continue; }
    const res = await polite(`${RAW}/${encodeURIComponent(f.name)}`);
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status} ${f.name}`);
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    fetched++;
    if (fetched % 500 === 0) console.log(`    …${fetched} fetched, ${cached} cached`);
  }
  console.log(`  ✓ audio: ${fetched} downloaded, ${cached} from cache`);

  const hash = createHash('sha256');
  let totalBytes = 0;
  const blobs = new Map<string, Buffer>();
  for (const f of needed) {
    const bytes = readFileSync(join(CACHE, f.name));
    blobs.set(f.name, bytes);
    totalBytes += bytes.length;
    hash.update(f.name).update(bytes);
  }
  const artifactSha = hash.digest('hex');
  recordArtifactSet({
    id: `audio-cmn:${DIR}`,
    url: `${REPO}/tree/master/${DIR}`,
    sha256: artifactSha,
    bytes: totalBytes,
    license: 'CC BY-SA (Yue Tan, Shtooka cmn-caen-tan collection)',
    notes: `${needed.length} HSK word mp3s (of ${files.length} upstream), matched to levelled pack words`,
  });
  const inputSha = createHash('sha256').update(artifactSha).update(`parser:${PARSER_VERSION}`).digest('hex');
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ zh-word-audio unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'audio-cmn (HSK word recordings)',
    url: REPO,
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    attributionText:
      'Mandarin word recordings by Yue Tan, from the Shtooka project’s cmn-caen-tan collection, republished as audio-cmn by Hugo Lopez. Licensed CC BY-SA; these recordings remain share-alike.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  const insertAudio = db.prepare(`
    INSERT INTO audio (id, lang, kind, location, speaker, license, attribution, source_id)
    VALUES (@id, 'zh', 'word', @location, 'Yue Tan', 'CC BY-SA 3.0', @attribution, '${SOURCE_ID}')
    ON CONFLICT(id) DO UPDATE SET location = excluded.location, attribution = excluded.attribution`);
  const insertBlob = db.prepare(`
    INSERT INTO audio_blobs (audio_id, bytes) VALUES (@audio_id, @bytes)
    ON CONFLICT(audio_id) DO UPDATE SET bytes = excluded.bytes`);
  const insertLink = db.prepare(`
    INSERT INTO word_audio (word_id, audio_id) VALUES (@word_id, @audio_id)
    ON CONFLICT(word_id, audio_id) DO NOTHING`);

  let clips = 0;
  let links = 0;
  db.transaction(() => {
    // Selection can change between runs (levels move, filters tighten) — clear first so
    // recordings that no longer qualify don't linger. Scoped to this source only.
    db.prepare(`DELETE FROM word_audio WHERE audio_id IN (SELECT id FROM audio WHERE source_id = ?)`).run(SOURCE_ID);
    db.prepare(`DELETE FROM audio_blobs WHERE audio_id IN (SELECT id FROM audio WHERE source_id = ?)`).run(SOURCE_ID);
    db.prepare(`DELETE FROM audio WHERE source_id = ?`).run(SOURCE_ID);

    for (const f of needed) {
      const word = wordOf(f.name);
      const bytes = blobs.get(f.name);
      if (!word || !bytes) continue;
      const aid = audioId('zh', SOURCE_ID, word);
      insertAudio.run({
        id: aid,
        location: `bundled:${DIR}/${f.name}`,
        attribution: 'Yue Tan (audio-cmn / Shtooka cmn-caen-tan), CC BY-SA 3.0',
      });
      insertBlob.run({ audio_id: aid, bytes });
      clips++;
      // One recording serves every homograph of that spelling — they sound the same only when
      // the reading matches, but CEDICT homographs here are overwhelmingly the same word.
      for (const wordIdStr of wanted.get(word) ?? []) {
        insertLink.run({ word_id: wordIdStr, audio_id: aid });
        links++;
      }
    }
  })();

  recordRun(db, SOURCE_ID, clips, inputSha);
  console.log(`  ✓ zh-word-audio: ${clips} recordings (${(totalBytes / 1048576).toFixed(1)} MB), ${links} word links`);
}
