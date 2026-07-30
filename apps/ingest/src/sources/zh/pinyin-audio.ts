/**
 * seed:zh-pinyin-audio — hugolpz/audio-cmn (CC BY-SA): 1,707 Mandarin syllable recordings.
 *
 * These are the surviving mirror of the Shtooka project's cmn-caen-tan collection (shtooka.net
 * itself is dead — see docs/RESEARCH-SOURCES.md). We take the `24k-abr` encoding: ~4.5 KB per
 * file, ~7.4 MB for the whole pinyin chart, which is small enough to live inside the content
 * pack instead of needing a separate audio pack.
 *
 * Files are named `cmn-{numberedPinyin}.mp3` (`cmn-zi4.mp3`, `cmn-_hm1.mp3` — the leading `_`
 * marks interjections with no standard onset). IDs key on that upstream token, never on the
 * tone-marked form, which is derived and therefore not a stable identifier.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { audioId, graphemeId } from '@mls/shared';
import { recordArtifactSet } from '../../lib/download';
import { DATA_CACHE } from '../../lib/paths';
import { polite } from '../../lib/politeness';
import { numberedToMarked } from '../../lib/pinyin';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'audio-cmn';
const REPO = 'https://github.com/hugolpz/audio-cmn';
const DIR = '24k-abr/syllabs';
const TREE_API = 'https://api.github.com/repos/hugolpz/audio-cmn/git/trees/master?recursive=1';
const RAW = `https://raw.githubusercontent.com/hugolpz/audio-cmn/master/${DIR}`;
const CACHE = join(DATA_CACHE, 'zh', 'pinyin-audio');

interface ApiEntry {
  name: string;
  size: number;
}

interface TreeEntry {
  path: string;
  type: string;
  size?: number;
}

/**
 * The *contents* API silently caps a directory at 1,000 entries and ignores `page`, so it
 * reports 1,000 of the 1,707 files (and re-serves the same page if you try to paginate).
 * The git trees API returns the whole tree in one request and tells us if it truncated.
 */
async function listFiles(): Promise<ApiEntry[]> {
  const res = await polite(TREE_API, { headers: { accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`audio-cmn tree listing failed: HTTP ${res.status}`);
  const tree = (await res.json()) as { tree?: TreeEntry[]; truncated?: boolean };
  if (!Array.isArray(tree.tree)) throw new Error('audio-cmn tree listing had no tree');
  if (tree.truncated) throw new Error('audio-cmn tree listing was truncated — cannot trust the file set');
  const prefix = `${DIR}/`;
  return tree.tree
    .filter((e) => e.type === 'blob' && e.path.startsWith(prefix) && e.path.endsWith('.mp3'))
    .map((e) => ({ name: e.path.slice(prefix.length), size: e.size ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchAll(files: ApiEntry[]): Promise<void> {
  mkdirSync(CACHE, { recursive: true });
  let fetched = 0;
  let cached = 0;
  for (const f of files) {
    const dest = join(CACHE, f.name);
    // Size check catches a truncated earlier run without re-downloading everything.
    if (existsSync(dest) && statSync(dest).size === f.size) {
      cached++;
      continue;
    }
    const res = await polite(`${RAW}/${encodeURIComponent(f.name)}`);
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status} ${f.name}`);
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    fetched++;
    if (fetched % 200 === 0) console.log(`    …${fetched} fetched, ${cached} already cached`);
  }
  console.log(`  ✓ audio: ${fetched} downloaded, ${cached} from cache`);
}

/**
 * Bumped whenever the parsing below changes. It is folded into the ingest hash so a parser
 * fix re-runs the seed — otherwise `alreadyIngested` sees unchanged *inputs* and skips, and
 * the fix never reaches the database.
 */
const PARSER_VERSION = 2;

/**
 * `cmn-_hm1.mp3` → { key: '_hm1', numbered: 'hm1', marked: 'hm', tone: 1 }
 *
 * Upstream filenames spell ü as `v` (`nv3`, `lv4`) — there is no `v` in pinyin, so the
 * substitution is unambiguous. Orthography detail: after j/q/x/y the ü sound is *written* u
 * (jù, not jǜ), so `v` becomes plain `u` there and `u:` — the spelling `numberedToMarked`
 * understands, inherited from CC-CEDICT — everywhere else.
 *
 * Syllabic nasals (m, n, ng, hm, hng) have no vowel to carry a mark, so they stay bare; the
 * tone still lives in `ord` and in the numbered `reading`.
 */
function parseName(name: string): { key: string; numbered: string; marked: string; tone: number } | null {
  const m = /^cmn-(.+)\.mp3$/.exec(name);
  if (!m) return null;
  const key = m[1]!;
  const numbered = key.replace(/^_+/, '');
  const tone = Number(/([1-5])$/.exec(numbered)?.[1] ?? 5);
  const spelled = numbered.replace(/([jqxy])v/g, '$1u').replace(/v/g, 'u:');
  return { key, numbered, marked: numberedToMarked(spelled), tone };
}

export async function run(db: DB): Promise<void> {
  const files = await listFiles();
  console.log(`  listing: ${files.length} syllable files in ${DIR}`);
  await fetchAll(files);

  // Aggregate hash over (name, bytes) in sorted order — one lock entry for 1,707 files.
  const hash = createHash('sha256');
  let totalBytes = 0;
  const blobs = new Map<string, Buffer>();
  for (const f of files) {
    const bytes = readFileSync(join(CACHE, f.name));
    blobs.set(f.name, bytes);
    totalBytes += bytes.length;
    hash.update(f.name).update(bytes);
  }
  // The lock records what we *downloaded*, so it must not move when only the parser changes.
  const artifactSha = hash.digest('hex');
  // The ingest guard must move, or a parser fix silently never reaches the database.
  const inputSha = createHash('sha256').update(artifactSha).update(`parser:${PARSER_VERSION}`).digest('hex');
  recordArtifactSet({
    id: `audio-cmn:${DIR}`,
    url: `${REPO}/tree/master/${DIR}`,
    sha256: artifactSha,
    bytes: totalBytes,
    license: 'CC BY-SA (Chen Wang, via the Shtooka cmn-caen-tan collection)',
    notes: `${files.length} mp3 files, aggregate hash over sorted (name, bytes)`,
  });

  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ zh-pinyin-audio unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'audio-cmn (Mandarin syllable recordings)',
    url: REPO,
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    attributionText:
      'Mandarin pinyin syllable recordings by Chen Wang, from the Shtooka project’s cmn-caen-tan collection, republished as audio-cmn by Hugo Lopez. Licensed CC BY-SA; these recordings remain share-alike.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  const insertAudio = db.prepare(`
    INSERT INTO audio (id, lang, kind, location, speaker, license, attribution, source_id)
    VALUES (@id, 'zh', 'syllable', @location, 'Chen Wang', 'CC BY-SA 3.0', @attribution, '${SOURCE_ID}')
    ON CONFLICT(id) DO UPDATE SET location = excluded.location, attribution = excluded.attribution`);
  const insertBlob = db.prepare(`
    INSERT INTO audio_blobs (audio_id, bytes) VALUES (@audio_id, @bytes)
    ON CONFLICT(audio_id) DO UPDATE SET bytes = excluded.bytes`);
  const insertGrapheme = db.prepare(`
    INSERT INTO graphemes (id, lang, glyph, kind, reading, ipa, stroke_json, diagram_ref, audio_id, ord, notes_md, source_id)
    VALUES (@id, 'zh', @glyph, 'pinyin_syllable', @reading, NULL, NULL, NULL, @audio_id, @ord, NULL, '${SOURCE_ID}')
    ON CONFLICT(id) DO UPDATE SET
      glyph = excluded.glyph, reading = excluded.reading, audio_id = excluded.audio_id, ord = excluded.ord`);

  let rows = 0;
  let skipped = 0;
  db.transaction(() => {
    for (const f of files) {
      const parsed = parseName(f.name);
      const bytes = blobs.get(f.name);
      if (!parsed || !bytes) { skipped++; continue; }
      const aid = audioId('zh', SOURCE_ID, parsed.key);
      insertAudio.run({
        id: aid,
        location: `bundled:${DIR}/${f.name}`,
        attribution: 'Chen Wang (audio-cmn / Shtooka cmn-caen-tan), CC BY-SA 3.0',
      });
      insertBlob.run({ audio_id: aid, bytes });
      insertGrapheme.run({
        // Keyed on the upstream filename token, NOT the tone-marked form (which we derive).
        id: graphemeId('zh', SOURCE_ID, parsed.key),
        glyph: parsed.marked,
        reading: parsed.numbered,
        audio_id: aid,
        ord: parsed.tone,
      });
      rows++;
    }
  })();

  recordRun(db, SOURCE_ID, rows, inputSha);
  console.log(`  ✓ zh-pinyin-audio: ${rows} syllables (${(totalBytes / 1048576).toFixed(1)} MB of mp3 in the pack)${skipped ? `, ${skipped} skipped` : ''}`);
}
