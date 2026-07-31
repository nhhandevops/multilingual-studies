/**
 * seed:fr-word-audio — French word pronunciations from Lingua Libre, via Wikimedia Commons
 * (CC BY-SA 4.0, one named speaker per recording).
 *
 * The file list does NOT come from a Commons category crawl. `Category:Lingua Libre
 * pronunciation-fra` holds 430,990 files, which is ~860 paginated API calls to discover a few
 * thousand we want — and it gives no word→file mapping, only filenames to parse. The kaikki
 * French extract we already download for `seed:fr-kaikki-en` carries a `sounds[]` array per
 * entry with `audio` (the Commons filename) and `mp3_url` (Commons' own transcode), which is
 * the same data already joined to the headword. So this seed re-reads that cached file and
 * skips the crawl entirely.
 *
 * Why the mp3 transcode and not the source file: Lingua Libre records WAV. `bonjour` is 117 KB
 * as WAV and 15 KB as Commons' mp3 transcode — for thousands of clips inside a bundled pack
 * that difference decides whether the feature ships at all.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { audioId } from '@mls/shared';
import { download, recordArtifactSet } from '../../lib/download';
import { DATA_CACHE } from '../../lib/paths';
import { polite } from '../../lib/politeness';
import { lines } from '../../lib/text';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'lingualibre-fra';
const KAIKKI_URL = 'https://kaikki.org/dictionary/French/kaikki.org-dictionary-French.jsonl.gz';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const CACHE = join(DATA_CACHE, 'fr', 'word-audio');
const PARSER_VERSION = 1;

/**
 * THE PACK-SIZE LEVER. Every levelled French word has ~13.8 KB of audio, so all six bands
 * (5,000 words) would add ~60 MB to a pack that is already 87.6 MB. A1–B1 is 2,949 words for
 * ~40 MB and covers the bands a learner actually drills; B2–C2 fall back to TTS, which is
 * exactly the role the roadmap gives TTS ("missing audio never blocks"). Widen this array to
 * bundle more — already-downloaded clips stay cached, so growing the set is cheap.
 */
const LEVELS = ['A1', 'A2', 'B1'];

/** Lingua Libre French recordings only — `LL-Q150 (fra)-<speaker>-<word>.wav`. Speakers AND
 *  words may contain hyphens (`sur-le-champ`), so the split is done by `speakerOf`, which
 *  anchors on the word the entry already gave us; this only screens the collection. */
const LL_FRA = /^LL-Q150 \(fra\)-.+\.wav$/i;

/** Reject anything that is not a free license we may bundle (invariant 2, and the 0.4 gate). */
const OK_LICENSE = /^(cc[- ]by(-sa)?([- ]\d(\.\d)?)?|cc0|public domain)/i;
const BAD_LICENSE = /\b(nc|nd|noncommercial|noderiv)\b/i;

interface Sound {
  audio?: string;
  mp3_url?: string;
  tags?: string[];
}

interface Candidate {
  word: string;
  file: string; //     Commons filename, e.g. "LL-Q150 (fra)-DSwissK-bonjour.wav"
  mp3: string;
  speaker: string;
  france: boolean; //  tagged as a France variety (preferred as the teaching default)
}

/** `LL-Q150 (fra)-DSwissK-bonjour.wav` → `DSwissK`. Speakers may contain hyphens; words may too,
 *  so anchor on the trailing `-<word>.wav` where <word> is what the entry already told us. */
function speakerOf(file: string, word: string): string | null {
  const stem = file.replace(/\.wav$/i, '');
  const prefix = 'LL-Q150 (fra)-';
  if (!stem.startsWith(prefix) || !stem.endsWith(`-${word}`)) return null;
  const speaker = stem.slice(prefix.length, stem.length - word.length - 1);
  return speaker.length > 0 ? speaker : null;
}

/** Windows rejects <>:"/\|?* in filenames and French words can carry apostrophes — hash-suffix
 *  a sanitised name so the cache stays browsable but can never collide. */
function cacheName(file: string): string {
  const safe = file.replace(/\.wav$/i, '').replace(/[<>:"/\\|?*]/g, '_').slice(0, 80);
  return `${safe}.${createHash('sha1').update(file).digest('hex').slice(0, 8)}.mp3`;
}

/** An mp3 starts with an ID3 tag or a frame sync — catches truncated files and error pages. */
function looksLikeMp3(bytes: Buffer): boolean {
  if (bytes.length < 4) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true; // "ID3"
  return bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0;
}

interface ImageInfo {
  title?: string;
  imageinfo?: { extmetadata?: Record<string, { value?: string }> }[];
  missing?: string;
}

/**
 * Ask Commons for the real license of each chosen file, 50 titles per call.
 *
 * The filename pattern is strong evidence a file is a Lingua Libre upload (CC BY-SA 4.0), but
 * "evidence" is not what invariant 2 asks for — the pack must carry a license we verified, and
 * the 0.4 gate is "zero NC/ND clips". 59 extra requests buys that outright.
 */
async function verifyLicenses(files: string[]): Promise<Map<string, { license: string; artist: string }>> {
  // Cached on disk: this crawl gets resumed (Wikimedia throttles it), and re-asking Commons
  // 56 times for answers we already have on every restart is exactly the rudeness polite()
  // exists to prevent.
  const cachePath = join(CACHE, '_licenses.json');
  const out = new Map<string, { license: string; artist: string }>();
  if (existsSync(cachePath)) {
    const seen = JSON.parse(readFileSync(cachePath, 'utf8')) as Record<string, { license: string; artist: string }>;
    for (const [k, v] of Object.entries(seen)) out.set(k, v);
  }
  const todo = files.filter((f) => !out.has(f));
  if (todo.length < files.length) console.log(`    ${files.length - todo.length} licenses from cache`);
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    const url =
      `${COMMONS_API}?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=extmetadata` +
      `&titles=${encodeURIComponent(batch.map((f) => `File:${f}`).join('|'))}`;
    const res = await polite(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Commons imageinfo failed: HTTP ${res.status}`);
    const json = (await res.json()) as { query?: { pages?: ImageInfo[] } };
    for (const page of json.query?.pages ?? []) {
      if (page.missing !== undefined || !page.title) continue;
      const em = page.imageinfo?.[0]?.extmetadata ?? {};
      const license = em['LicenseShortName']?.value?.trim() ?? '';
      const artist = (em['Artist']?.value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      out.set(page.title.replace(/^File:/, ''), { license, artist });
    }
    if (i > 0 && i % 1000 === 0) console.log(`    …licenses ${i}/${todo.length}`);
  }
  if (todo.length > 0) writeFileSync(cachePath, JSON.stringify(Object.fromEntries(out)));
  return out;
}

export async function run(db: DB): Promise<void> {
  mkdirSync(CACHE, { recursive: true }); //  the license cache is written before any download
  // Same lock key as seed:fr-kaikki-en on purpose — one artifact, one provenance entry.
  const kaikkiPath = await download({
    id: 'kaikki:dictionary-French.jsonl.gz',
    url: KAIKKI_URL,
    relPath: 'fr/kaikki.org-dictionary-French.jsonl.gz',
    license: 'CC BY-SA 4.0 + GFDL (Wiktionary content, wiktextract by Tatu Ylonen)',
  });

  const wanted = new Map<string, string[]>(); //  headword → word ids
  const placeholders = LEVELS.map(() => '?').join(',');
  for (const r of db
    .prepare(`SELECT id, headword FROM words WHERE lang = 'fr' AND level IN (${placeholders})`)
    .all(...LEVELS) as { id: string; headword: string }[]) {
    const list = wanted.get(r.headword);
    if (list) list.push(r.id);
    else wanted.set(r.headword, [r.id]);
  }
  console.log(`  target: ${wanted.size} French words in ${LEVELS.join('/')}`);

  // Collect every Lingua Libre recording offered for a word we want.
  const byWord = new Map<string, Candidate[]>();
  const speakerCount = new Map<string, number>();
  for await (const line of lines(kaikkiPath)) {
    if (line.length === 0) continue;
    let entry: { word?: string; sounds?: Sound[] };
    try {
      entry = JSON.parse(line) as { word?: string; sounds?: Sound[] };
    } catch {
      continue;
    }
    const word = entry.word;
    if (!word || !wanted.has(word)) continue;
    for (const s of entry.sounds ?? []) {
      if (!s.audio || !s.mp3_url || !LL_FRA.test(s.audio)) continue;
      const speaker = speakerOf(s.audio, word);
      if (!speaker) continue;
      const list = byWord.get(word) ?? [];
      if (list.some((c) => c.file === s.audio)) continue;
      const tags = s.tags ?? [];
      list.push({
        word,
        file: s.audio,
        mp3: s.mp3_url,
        speaker,
        france: tags.some((t) => /^(france|paris|lyon|toulouse|marseille|bretagne|alsace|normandie)$/i.test(t)),
      });
      byWord.set(word, list);
      speakerCount.set(speaker, (speakerCount.get(speaker) ?? 0) + 1);
    }
  }

  // One recording per word, chosen deterministically. France-tagged first (the teaching default
  // for a learner), then the most prolific speaker — a consistent voice across a study session
  // beats a different stranger on every card — then filename, so ties never depend on file order.
  const chosen: Candidate[] = [];
  for (const [, list] of [...byWord].sort(([a], [b]) => a.localeCompare(b))) {
    list.sort(
      (a, b) =>
        Number(b.france) - Number(a.france) ||
        (speakerCount.get(b.speaker) ?? 0) - (speakerCount.get(a.speaker) ?? 0) ||
        a.file.localeCompare(b.file),
    );
    chosen.push(list[0]!);
  }
  const missing = wanted.size - chosen.length;
  console.log(`  ${chosen.length} words have a Lingua Libre recording (${missing} fall back to TTS)`);

  console.log(`  verifying licenses on Commons (${Math.ceil(chosen.length / 50)} batched calls)…`);
  const licenses = await verifyLicenses(chosen.map((c) => c.file));
  const usable: Candidate[] = [];
  let unverified = 0;
  let rejected = 0;
  for (const c of chosen) {
    const info = licenses.get(c.file);
    if (!info || info.license.length === 0) {
      unverified++;
      continue;
    }
    if (BAD_LICENSE.test(info.license) || !OK_LICENSE.test(info.license)) {
      console.warn(`  ! rejected ${c.file}: license "${info.license}"`);
      rejected++;
      continue;
    }
    usable.push(c);
  }
  console.log(`  ✓ licenses: ${usable.length} free, ${rejected} rejected, ${unverified} unverified (skipped)`);
  if (usable.length === 0) throw new Error('no usable Lingua Libre recordings — refusing to write an empty source');

  let fetched = 0;
  let cached = 0;
  let failed = 0;
  const todo = usable.filter((c) => {
    const dest = join(CACHE, cacheName(c.file));
    if (existsSync(dest) && statSync(dest).size > 0) {
      cached++;
      return false;
    }
    return true;
  });

  /**
   * A few requests in flight at once. Each round-trip to upload.wikimedia.org costs ~1.7 s, so
   * awaiting them one at a time spends the whole crawl idle — 2,700 clips took 77 minutes that
   * way. Overlap is safe because the real rate limit lives in `polite()`, which spaces every
   * request to this host 250 ms apart no matter how many callers are waiting; this only stops
   * us leaving that budget unspent. Wikimedia documents ~15,000 files/hour as acceptable for
   * bulk Lingua Libre downloads, which is still above what the queue will ever emit.
   */
  // More workers than polite() will run at once, deliberately: the queue (2 in flight, 250 ms
  // apart) stays the single place rate is decided, and these just keep it saturated. Raising
  // the queue instead was tried and measured worse — upload.wikimedia.org answers 429.
  const WORKERS = 6;
  let next = 0;
  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      for (;;) {
        const c = todo[next++];
        if (!c) return;
        const dest = join(CACHE, cacheName(c.file));
        let res;
        try {
          res = await polite(c.mp3);
        } catch (e) {
          // polite() gives up after four tries. That is TRANSIENT, so no marker file is written
          // and the next run retries this word — but a wall of them means we are being refused,
          // and grinding on would just be rude.
          failed++;
          console.warn(`  ! download failed (${failed}): ${c.file} — ${e instanceof Error ? e.message : String(e)}`);
          if (failed > 100) throw new Error(`aborting after ${failed} download failures — re-run later to resume`);
          continue;
        }
        if (!res.ok) {
          // A transcode can be missing for one file without the crawl being wrong; skip it and
          // let TTS cover that word rather than failing 2,700 good downloads. This one IS
          // permanent, so it gets an empty marker and is not retried on every future run.
          console.warn(`  ! transcode unavailable (HTTP ${res.status}): ${c.file}`);
          writeFileSync(dest, Buffer.alloc(0));
          continue;
        }
        const bytes = Buffer.from(await res.arrayBuffer());
        if (!looksLikeMp3(bytes)) {
          console.warn(`  ! not an mp3, skipping: ${c.file}`);
          writeFileSync(dest, Buffer.alloc(0));
          continue;
        }
        writeFileSync(dest, bytes);
        fetched++;
        if (fetched % 250 === 0) console.log(`    …${fetched}/${todo.length} fetched, ${cached} cached`);
      }
    }),
  );
  console.log(`  ✓ audio: ${fetched} downloaded, ${cached} from cache, ${failed} failed`);

  // Only clips that actually landed on disk are ingested.
  const ready = usable.filter((c) => {
    const p = join(CACHE, cacheName(c.file));
    return existsSync(p) && statSync(p).size > 0;
  });

  const hash = createHash('sha256');
  let totalBytes = 0;
  const blobs = new Map<string, Buffer>();
  for (const c of ready) {
    const bytes = readFileSync(join(CACHE, cacheName(c.file)));
    blobs.set(c.file, bytes);
    totalBytes += bytes.length;
    hash.update(c.file).update(bytes);
  }
  const artifactSha = hash.digest('hex');
  recordArtifactSet({
    id: `lingualibre:fra/${LEVELS.join('+')}`,
    url: 'https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation-fra',
    sha256: artifactSha,
    bytes: totalBytes,
    license: 'CC BY-SA 4.0 (Lingua Libre speakers, via Wikimedia Commons)',
    notes: `${ready.length} French word mp3 transcodes for levels ${LEVELS.join('/')}; license verified per file via the Commons API`,
  });
  const inputSha = createHash('sha256').update(artifactSha).update(`parser:${PARSER_VERSION}`).digest('hex');
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ fr-word-audio unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'Lingua Libre (French word recordings)',
    url: 'https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation-fra',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attributionText:
      'French word recordings by Lingua Libre contributors (Wikimédia France), hosted on Wikimedia Commons. Each clip credits its own speaker; all are licensed CC BY-SA 4.0 and remain share-alike.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  const insertAudio = db.prepare(`
    INSERT INTO audio (id, lang, kind, location, speaker, license, attribution, source_id)
    VALUES (@id, 'fr', 'word', @location, @speaker, 'CC BY-SA 4.0', @attribution, '${SOURCE_ID}')
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
    // Selection changes whenever LEVELS or the license filter changes, and upserts never remove.
    db.prepare(`DELETE FROM word_audio WHERE audio_id IN (SELECT id FROM audio WHERE source_id = ?)`).run(SOURCE_ID);
    db.prepare(`DELETE FROM audio_blobs WHERE audio_id IN (SELECT id FROM audio WHERE source_id = ?)`).run(SOURCE_ID);
    db.prepare(`DELETE FROM audio WHERE source_id = ?`).run(SOURCE_ID);

    for (const c of ready) {
      const bytes = blobs.get(c.file);
      if (!bytes) continue;
      const aid = audioId('fr', SOURCE_ID, c.word);
      insertAudio.run({
        id: aid,
        location: `bundled:lingualibre/${c.file}`,
        speaker: c.speaker,
        attribution: `${c.speaker} (Lingua Libre, Wikimedia Commons), CC BY-SA 4.0`,
      });
      insertBlob.run({ audio_id: aid, bytes });
      clips++;
      for (const wordIdStr of wanted.get(c.word) ?? []) {
        insertLink.run({ word_id: wordIdStr, audio_id: aid });
        links++;
      }
    }
  })();

  recordRun(db, SOURCE_ID, clips, inputSha);
  console.log(
    `  ✓ fr-word-audio: ${clips} recordings (${(totalBytes / 1048576).toFixed(1)} MB), ${links} word links, ${new Set(ready.map((c) => c.speaker)).size} speakers`,
  );
}
