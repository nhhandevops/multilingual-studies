/**
 * seed:ipa-sagittal — drammock/phonetics-teaching-assets (CC0): 51 vocal-tract SVGs by
 * Richard Wright & Dan McCloy (Univ. of Washington).
 *
 * These are language-neutral, so they land as `lang='all'`, `kind='ipa_phone'` graphemes with
 * `diagram_ref` pointing into `asset_blobs`. CC0 means no attribution is legally required —
 * we credit them anyway, and `pack verify` needs a registered source for every row regardless.
 *
 * The filename→phone mapping below is explicit on purpose: upstream names encode variants
 * (`s_apical` vs `s_laminal`, the three-frame click sequence `kǃ_1..3`) that no rule recovers,
 * and a silently wrong IPA symbol would be worse than a missing one.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { graphemeId } from '@mls/shared';
import { recordArtifactSet } from '../../lib/download';
import { DATA_CACHE } from '../../lib/paths';
import { polite } from '../../lib/politeness';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'sagittal';
const REPO = 'https://github.com/drammock/phonetics-teaching-assets';
const TREE_API = 'https://api.github.com/repos/drammock/phonetics-teaching-assets/git/trees/main?recursive=1';
const RAW = 'https://raw.githubusercontent.com/drammock/phonetics-teaching-assets/main';
const CACHE = join(DATA_CACHE, 'shared', 'sagittal');
const PARSER_VERSION = 1;

type Category = 'consonant' | 'vowel' | 'glottis' | 'airstream';

interface Phone {
  symbol: string; //  IPA (or a short label for non-phone diagrams)
  name: string; //    English description shown under the chart
  category: Category;
}

/** filename stem → phone. Anything not listed is skipped and reported. */
const PHONES: Record<string, Phone> = {
  // consonants
  p: { symbol: 'p', name: 'voiceless bilabial plosive', category: 'consonant' },
  b: { symbol: 'b', name: 'voiced bilabial plosive', category: 'consonant' },
  t: { symbol: 't', name: 'voiceless alveolar plosive', category: 'consonant' },
  d: { symbol: 'd', name: 'voiced alveolar plosive', category: 'consonant' },
  k: { symbol: 'k', name: 'voiceless velar plosive', category: 'consonant' },
  g: { symbol: 'ɡ', name: 'voiced velar plosive', category: 'consonant' },
  q: { symbol: 'q', name: 'voiceless uvular plosive', category: 'consonant' },
  c: { symbol: 'c', name: 'voiceless palatal plosive', category: 'consonant' },
  'ɟ': { symbol: 'ɟ', name: 'voiced palatal plosive', category: 'consonant' },
  'ɢ': { symbol: 'ɢ', name: 'voiced uvular plosive', category: 'consonant' },
  m: { symbol: 'm', name: 'bilabial nasal', category: 'consonant' },
  n: { symbol: 'n', name: 'alveolar nasal', category: 'consonant' },
  'ŋ': { symbol: 'ŋ', name: 'velar nasal', category: 'consonant' },
  'ɲ': { symbol: 'ɲ', name: 'palatal nasal', category: 'consonant' },
  'ɴ': { symbol: 'ɴ', name: 'uvular nasal', category: 'consonant' },
  f: { symbol: 'f', name: 'voiceless labiodental fricative', category: 'consonant' },
  v: { symbol: 'v', name: 'voiced labiodental fricative', category: 'consonant' },
  'θ': { symbol: 'θ', name: 'voiceless dental fricative — English “think”', category: 'consonant' },
  eth: { symbol: 'ð', name: 'voiced dental fricative — English “this”', category: 'consonant' },
  s_apical: { symbol: 's', name: 'voiceless alveolar fricative (apical)', category: 'consonant' },
  s_laminal: { symbol: 's', name: 'voiceless alveolar fricative (laminal)', category: 'consonant' },
  z_apical: { symbol: 'z', name: 'voiced alveolar fricative (apical)', category: 'consonant' },
  z_laminal: { symbol: 'z', name: 'voiced alveolar fricative (laminal)', category: 'consonant' },
  'ʃ_apical': { symbol: 'ʃ', name: 'voiceless postalveolar fricative (apical)', category: 'consonant' },
  'ʃ_laminal': { symbol: 'ʃ', name: 'voiceless postalveolar fricative (laminal)', category: 'consonant' },
  // Upstream ships no ʒ_laminal — ʃ, s and z have both variants, ʒ only apical.
  'ʒ_apical': { symbol: 'ʒ', name: 'voiced postalveolar fricative (apical)', category: 'consonant' },
  'ç': { symbol: 'ç', name: 'voiceless palatal fricative', category: 'consonant' },
  'ʝ': { symbol: 'ʝ', name: 'voiced palatal fricative', category: 'consonant' },
  'χ': { symbol: 'χ', name: 'voiceless uvular fricative — one French “r”', category: 'consonant' },
  'ʁ': { symbol: 'ʁ', name: 'voiced uvular fricative — the usual French “r”', category: 'consonant' },
  'ħ': { symbol: 'ħ', name: 'voiceless pharyngeal fricative', category: 'consonant' },
  'ʕ': { symbol: 'ʕ', name: 'voiced pharyngeal fricative', category: 'consonant' },
  r_retroflex: { symbol: 'ɻ', name: 'retroflex approximant — Mandarin “r”', category: 'consonant' },
  'kǃ_1': { symbol: 'ǃ', name: 'alveolar click — 1. closure', category: 'consonant' },
  'kǃ_2': { symbol: 'ǃ', name: 'alveolar click — 2. rarefaction', category: 'consonant' },
  'kǃ_3': { symbol: 'ǃ', name: 'alveolar click — 3. release', category: 'consonant' },
  neutral: { symbol: '◌', name: 'neutral / rest position', category: 'consonant' },
  // vowels
  i: { symbol: 'i', name: 'close front unrounded', category: 'vowel' },
  'ɪ': { symbol: 'ɪ', name: 'near-close near-front unrounded', category: 'vowel' },
  'ɛ': { symbol: 'ɛ', name: 'open-mid front unrounded', category: 'vowel' },
  'æ': { symbol: 'æ', name: 'near-open front unrounded', category: 'vowel' },
  a: { symbol: 'a', name: 'open front unrounded', category: 'vowel' },
  u: { symbol: 'u', name: 'close back rounded', category: 'vowel' },
  'ʊ': { symbol: 'ʊ', name: 'near-close near-back rounded', category: 'vowel' },
  // glottis states
  glottis_modal: { symbol: 'modal', name: 'modal voicing', category: 'glottis' },
  glottis_creaky: { symbol: 'creaky', name: 'creaky voice', category: 'glottis' },
  glottis_murmur: { symbol: 'murmur', name: 'breathy voice / murmur', category: 'glottis' },
  glottis_voiceless_narrow: { symbol: 'voiceless', name: 'voiceless, narrow glottis', category: 'glottis' },
  glottis_voiceless_wide: { symbol: 'voiceless', name: 'voiceless, wide glottis', category: 'glottis' },
  // airstream
  pulmonic_1: { symbol: 'pulmonic', name: 'pulmonic egressive airstream — 1', category: 'airstream' },
  pulmonic_2: { symbol: 'pulmonic', name: 'pulmonic egressive airstream — 2', category: 'airstream' },
};

const ORDER: Category[] = ['consonant', 'vowel', 'glottis', 'airstream'];

interface TreeEntry { path: string; type: string; size?: number }

async function listSvgs(): Promise<{ path: string; stem: string }[]> {
  const res = await polite(TREE_API, { headers: { accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`sagittal tree listing failed: HTTP ${res.status}`);
  const tree = (await res.json()) as { tree?: TreeEntry[]; truncated?: boolean };
  if (!Array.isArray(tree.tree)) throw new Error('sagittal tree listing had no tree');
  if (tree.truncated) throw new Error('sagittal tree listing was truncated');
  return tree.tree
    .filter((e) => e.type === 'blob' && e.path.toLowerCase().endsWith('.svg'))
    .map((e) => ({ path: e.path, stem: e.path.split('/').pop()!.replace(/\.svg$/i, '') }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function run(db: DB): Promise<void> {
  const files = await listSvgs();
  mkdirSync(CACHE, { recursive: true });
  let fetched = 0;
  for (const f of files) {
    const dest = join(CACHE, `${f.stem}.svg`);
    if (existsSync(dest) && statSync(dest).size > 0) continue;
    const res = await polite(`${RAW}/${f.path.split('/').map(encodeURIComponent).join('/')}`);
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status} ${f.path}`);
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    fetched++;
  }
  console.log(`  ✓ sagittal: ${files.length} svgs (${fetched} downloaded, ${files.length - fetched} cached)`);

  const hash = createHash('sha256');
  let totalBytes = 0;
  const svgs = new Map<string, Buffer>();
  for (const f of files) {
    const bytes = readFileSync(join(CACHE, `${f.stem}.svg`));
    svgs.set(f.stem, bytes);
    totalBytes += bytes.length;
    hash.update(f.stem).update(bytes);
  }
  const artifactSha = hash.digest('hex');
  recordArtifactSet({
    id: 'sagittal:svg',
    url: REPO,
    sha256: artifactSha,
    bytes: totalBytes,
    license: 'CC0 1.0 (Richard Wright & Dan McCloy, University of Washington)',
    notes: `${files.length} vocal-tract SVGs, aggregate hash over sorted (stem, bytes)`,
  });
  const inputSha = createHash('sha256').update(artifactSha).update(`parser:${PARSER_VERSION}`).digest('hex');
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ ipa-sagittal unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'Phonetics teaching assets (sagittal diagrams)',
    url: REPO,
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionText:
      'Midsagittal vocal-tract diagrams by Richard Wright and Dan McCloy (University of Washington), released into the public domain under CC0 1.0. Credited voluntarily — CC0 requires nothing.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  const insertAsset = db.prepare(`
    INSERT INTO asset_blobs (id, mime, bytes, source_id)
    VALUES (@id, 'image/svg+xml', @bytes, '${SOURCE_ID}')
    ON CONFLICT(id) DO UPDATE SET bytes = excluded.bytes, mime = excluded.mime`);
  const insertGrapheme = db.prepare(`
    INSERT INTO graphemes (id, lang, glyph, kind, reading, ipa, stroke_json, diagram_ref, audio_id, ord, notes_md, source_id)
    VALUES (@id, 'all', @glyph, 'ipa_phone', NULL, @ipa, NULL, @diagram_ref, NULL, @ord, @notes_md, '${SOURCE_ID}')
    ON CONFLICT(id) DO UPDATE SET
      glyph = excluded.glyph, ipa = excluded.ipa, diagram_ref = excluded.diagram_ref,
      ord = excluded.ord, notes_md = excluded.notes_md`);

  let rows = 0;
  const unmapped: string[] = [];
  db.transaction(() => {
    let ord = 0;
    for (const category of ORDER) {
      for (const f of files) {
        const phone = PHONES[f.stem];
        if (!phone) continue;
        if (phone.category !== category) continue;
        const bytes = svgs.get(f.stem);
        if (!bytes) continue;
        const assetId = `asset:${SOURCE_ID}:${f.stem}`;
        insertAsset.run({ id: assetId, bytes });
        insertGrapheme.run({
          // Keyed on the upstream filename stem: it distinguishes apical/laminal variants that
          // share one IPA symbol, so the symbol alone would collide.
          id: graphemeId('all', SOURCE_ID, f.stem),
          glyph: phone.symbol,
          ipa: phone.symbol,
          diagram_ref: assetId,
          ord: ord++,
          notes_md: `${phone.name} · ${phone.category}`,
        });
        rows++;
      }
    }
    for (const f of files) if (!PHONES[f.stem]) unmapped.push(f.stem);
  })();

  recordRun(db, SOURCE_ID, rows, inputSha);
  console.log(`  ✓ ipa-sagittal: ${rows} diagrams (${(totalBytes / 1024).toFixed(0)} KB)`);
  if (unmapped.length > 0) console.log(`    ! ${unmapped.length} unmapped file(s), add to PHONES: ${unmapped.join(' ')}`);
}
