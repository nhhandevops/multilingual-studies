/**
 * seed:fr-grammar — Tex's French Grammar (COERLL / UT Austin), bundled verbatim.
 *
 * This is the best-licensed grammar text available to the project: the pages themselves carry a
 * CC BY 3.0 mark (verified on every page we ingest, not assumed from the ledger — see v0.4's
 * licensing lesson), which unlike Wikibooks' CC BY-SA puts no share-alike obligation on anything
 * derived from it. So the prose ships in full rather than as links.
 *
 * The 130 grammar pages are enumerated from the site's own index, which also fixes their teaching
 * order — that order is the pedagogy and is worth more than alphabetical listing, so it becomes
 * `ord`. Tex is not CEFR-graded and `level` is left NULL rather than invented.
 *
 * AUDIO IS NOT BUNDLED BY DEFAULT. Tex ships 730 recorded example clips. The podcast feed says
 * 114 MB, but that counts ~82 KB of duplicated cover art per clip; the plain files are roughly
 * half that. Even so, one clip per page across all 300 pages is tens of MB against a pack that is
 * already 128.9 MB and whose size is the project's flagged open decision. `AUDIO_CHAPTERS` is the
 * lever, and it is deliberately narrow.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { audioId, grammarId } from '@mls/shared';
import { recordArtifactSet } from '../../lib/download';
import { DATA_CACHE } from '../../lib/paths';
import { polite } from '../../lib/politeness';
import { decodeHtml } from '../../lib/text';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'texs-french-grammar';
const SITE = 'https://www.laits.utexas.edu/tex';
const INDEX = `${SITE}/gr/index.html`;
const CACHE = join(DATA_CACHE, 'fr', 'tex');
const PARSER_VERSION = 3; //  3: plain /aud/ clips, not the cover-art-laden podcast copies

/**
 * THE AUDIO LEVER. Chapters listed here get a recording for the first example on each of their
 * pages; every other example relies on the TTS fallback v0.4 shipped.
 *
 * Measured on the plain (non-podcast) files: `['adj']` is 8 clips / 1.0 MB and proves the feature
 * end to end. `[]` disables audio entirely. All 11 chapters, one clip per page, is roughly 22 MB
 * — the number to weigh against the pack-size decision in HANDOFF before widening this.
 */
const AUDIO_CHAPTERS = ['adj'];

/** The page's own CC BY mark. If a page stops carrying it, we stop bundling that page. */
const CC_BY_MARK = /creativecommons\.org\/licenses\/by\//i;

interface Page {
  code: string; //   'adj1'
  chapter: string; // 'adj'
  ord: number; //     position in the site's own index = teaching order
}

/** Enumerate the grammar pages in the order the index lists them. */
async function listPages(): Promise<Page[]> {
  const html = await fetchPage(INDEX);
  const seen = new Set<string>();
  const out: Page[] = [];
  for (const m of html.matchAll(/([a-z]{1,5}\d+[a-z]?)\.html/gi)) {
    const code = m[1]!.toLowerCase();
    if (seen.has(code) || code === 'index') continue;
    seen.add(code);
    out.push({ code, chapter: /^([a-z]+)/.exec(code)![1]!, ord: out.length });
  }
  return out;
}

async function fetchPage(url: string): Promise<string> {
  const res = await polite(url);
  if (!res.ok) throw new Error(`tex: HTTP ${res.status} ${url}`);
  // Served as iso-8859-1; decoding as UTF-8 mangles every accented French vowel.
  return new TextDecoder('iso-8859-1').decode(Buffer.from(await res.arrayBuffer()));
}

/**
 * The teaching content, converted to markdown.
 *
 * The pages are 1990s table layout, but they delimit the lesson explicitly with
 * `<!-- content -->` … `<!-- END content -->`, and every example is a two-column row of
 * French | English. That structure is worth preserving: an example whose translation has been
 * flattened into the same paragraph is much less useful than a labelled pair.
 */
function toMarkdown(html: string): string {
  const start = html.indexOf('<!-- content -->');
  const end = html.indexOf('<!-- END content -->');
  if (start < 0 || end < 0 || end <= start) return '';
  let s = html.slice(start + '<!-- content -->'.length, end);

  s = s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');

  // Two-column example rows → "- **French** — English", before generic tag stripping.
  s = s.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (row) => {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      inline(c[1]!).trim(),
    );
    // No outer bold: the French cell usually already carries emphasis on the word being taught
    // (`<span class="tb_blue">`), and wrapping it produced `**Tex est un tatou **philosophique**.**`
    // — nested markers that no markdown renderer reads as intended. Keep the author's own
    // emphasis and separate the pair with an em dash instead.
    if (cells.length === 2 && cells[0] && cells[1]) return `\n- ${cells[0]} — ${cells[1]}`;
    return cells.filter(Boolean).length > 0 ? `\n${cells.filter(Boolean).join(' — ')}` : '\n';
  });

  s = s.replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, lv: string, t: string) => `\n\n${'#'.repeat(Number(lv) + 1)} ${inline(t).trim()}\n\n`);
  s = s.replace(/<\/p>|<br\s*\/?>/gi, '\n');
  s = inline(s);
  return s
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Inline emphasis + tag strip + entity decode, shared by cell and body conversion. */
function inline(s: string): string {
  return decodeHtml(
    s
      .replace(/<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>/gi, '**$1**')
      .replace(/<span class="tb_blue"[^>]*>([\s\S]*?)<\/span>/gi, '**$1**')
      .replace(/<(?:i|em)[^>]*>([\s\S]*?)<\/(?:i|em)>/gi, '*$1*')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\*\*\s*\*\*/g, '');
}

function titleOf(html: string, code: string): string {
  const m = /<title>([\s\S]*?)<\/title>/i.exec(html);
  const raw = m ? decodeHtml(m[1]!).replace(/\s+/g, ' ').trim() : code;
  // "adj1: introduction to adjectives" → "introduction to adjectives"
  return raw.replace(new RegExp(`^${code}\\s*:\\s*`, 'i'), '').trim() || code;
}

/**
 * Recorded examples for a chapter, from its podcast feed.
 *
 * The feed advertises `/tex/aud/itunes/<name>.mp3`, and those are the PODCAST copies: each one
 * carries an ID3 `APIC` frame holding the same ~82 KB cover JPEG. The plain `/tex/aud/<name>.mp3`
 * is the identical recording without it — measured, adj2_ex1 is 136,798 B as the iTunes copy and
 * 54,960 B plain, adj8_ex1 132,096 → 51,825. Bundling the feed URL would have put one copy of the
 * same album art into the pack per clip, and would have made every future widening of
 * AUDIO_CHAPTERS roughly twice as expensive as it needs to be.
 */
async function chapterAudio(chapter: string): Promise<{ page: string; url: string; bytes: number }[]> {
  const res = await polite(`${SITE}/rss.php?ch=${chapter}`);
  if (!res.ok) return [];
  const xml = await res.text();
  return [...xml.matchAll(/<enclosure[^>]*url="([^"]+)"[^>]*length="(\d+)"/gi)].map((m) => ({
    page: m[1]!.split('/').pop()!.replace(/_ex\d+\.mp3$/i, ''),
    url: m[1]!.replace('/aud/itunes/', '/aud/'),
    bytes: Number(m[2]), //  the feed's own figure, which counts the cover art — not what we store
  }));
}

/** Cover art has no place in a pronunciation clip; catch it if the plain path ever changes. */
function hasCoverArt(bytes: Buffer): boolean {
  return bytes.subarray(0, 4096).includes(Buffer.from('APIC'));
}

export async function run(db: DB): Promise<void> {
  mkdirSync(CACHE, { recursive: true });
  const pages = await listPages();
  console.log(`  index: ${pages.length} grammar pages in ${new Set(pages.map((p) => p.chapter)).size} chapters`);

  const docs: { page: Page; title: string; body: string }[] = [];
  let unlicensed = 0;
  for (const p of pages) {
    const dest = join(CACHE, `${p.code}.html`);
    let html: string;
    if (existsSync(dest) && statSync(dest).size > 0) html = readFileSync(dest, 'utf8');
    else {
      html = await fetchPage(`${SITE}/gr/${p.code}.html`);
      writeFileSync(dest, html, 'utf8');
    }
    // Verify the licence on the page itself. v0.4 shipped 1,870 clips stamped with a licence
    // their authors never chose because the ledger was trusted over the artefact; not again.
    if (!CC_BY_MARK.test(html)) {
      console.warn(`  ! ${p.code}: no CC BY mark on the page — skipped`);
      unlicensed++;
      continue;
    }
    const body = toMarkdown(html);
    if (body.length < 80) continue; //  nav-only stubs
    docs.push({ page: p, title: titleOf(html, p.code), body });
  }
  console.log(`  ✓ text: ${docs.length} pages extracted (${unlicensed} without a CC BY mark)`);

  // ---- audio (opt-in, see AUDIO_CHAPTERS) ---------------------------------------------------
  const clips: { page: string; url: string; bytes: number; file: string }[] = [];
  for (const ch of AUDIO_CHAPTERS) {
    const firstPerPage = new Map<string, { page: string; url: string; bytes: number }>();
    for (const c of await chapterAudio(ch)) if (!firstPerPage.has(c.page)) firstPerPage.set(c.page, c);
    for (const c of firstPerPage.values()) {
      const file = join(CACHE, c.url.split('/').pop()!);
      if (!existsSync(file) || statSync(file).size === 0) {
        const res = await polite(c.url);
        if (!res.ok) { console.warn(`  ! audio HTTP ${res.status} ${c.url}`); continue; }
        const bytes = Buffer.from(await res.arrayBuffer());
        if (hasCoverArt(bytes)) {
          console.warn(`  ! ${c.url} still carries embedded cover art — skipped`);
          continue;
        }
        writeFileSync(file, bytes);
      }
      clips.push({ ...c, file });
    }
  }
  const audioBytes = clips.reduce((a, c) => a + statSync(c.file).size, 0);
  console.log(`  ✓ audio: ${clips.length} clips (${(audioBytes / 1048576).toFixed(1)} MB) from ${AUDIO_CHAPTERS.join('/') || 'no chapters'}`);

  const hash = createHash('sha256');
  for (const d of docs) hash.update(d.page.code).update(d.body);
  for (const c of clips) hash.update(c.url).update(readFileSync(c.file));
  const artifactSha = hash.digest('hex');
  recordArtifactSet({
    id: 'texs-french-grammar',
    url: `${SITE}/gr/index.html`,
    sha256: artifactSha,
    bytes: docs.reduce((a, d) => a + d.body.length, 0) + audioBytes,
    license: 'CC BY 3.0 (COERLL / University of Texas at Austin)',
    notes: `${docs.length} grammar pages + ${clips.length} recorded examples (chapters: ${AUDIO_CHAPTERS.join(',') || 'none'})`,
  });
  const inputSha = createHash('sha256').update(artifactSha).update(`parser:${PARSER_VERSION}`).digest('hex');
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ fr-grammar unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: "Tex's French Grammar (COERLL, UT Austin)",
    url: `${SITE}/`,
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    attributionText:
      "Tex's French Grammar, from Français Interactif by COERLL, the Center for Open Educational Resources and Language Learning at the University of Texas at Austin. Licensed CC BY 3.0 — bundled verbatim with attribution; no share-alike obligation.",
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  const insertTopic = db.prepare(`
    INSERT INTO grammar_topics (id, lang, code, title_en, title_vi, level, ord, body_md, external_links, source_id)
    VALUES (@id, 'fr', @code, @title_en, NULL, NULL, @ord, @body_md, @external_links, '${SOURCE_ID}')
    ON CONFLICT(id) DO UPDATE SET
      title_en = excluded.title_en, ord = excluded.ord, body_md = excluded.body_md,
      external_links = excluded.external_links`);
  const insertAudio = db.prepare(`
    INSERT INTO audio (id, lang, kind, location, speaker, license, attribution, source_id)
    VALUES (@id, 'fr', 'sentence', @location, 'Français Interactif', 'CC BY 3.0', @attribution, '${SOURCE_ID}')
    ON CONFLICT(id) DO UPDATE SET location = excluded.location, attribution = excluded.attribution`);
  const insertBlob = db.prepare(`
    INSERT INTO audio_blobs (audio_id, bytes) VALUES (@audio_id, @bytes)
    ON CONFLICT(audio_id) DO UPDATE SET bytes = excluded.bytes`);

  const clipByPage = new Map(clips.map((c) => [c.page, c]));
  let n = 0;
  let withAudio = 0;
  db.transaction(() => {
    db.prepare(`DELETE FROM audio_blobs WHERE audio_id IN (SELECT id FROM audio WHERE source_id = ?)`).run(SOURCE_ID);
    db.prepare(`DELETE FROM audio WHERE source_id = ?`).run(SOURCE_ID);
    db.prepare(`DELETE FROM grammar_topics WHERE source_id = ?`).run(SOURCE_ID);

    for (const d of docs) {
      const clip = clipByPage.get(d.page.code);
      let aid: string | null = null;
      if (clip) {
        aid = audioId('fr', SOURCE_ID, d.page.code);
        insertAudio.run({
          id: aid,
          location: `bundled:tex/${clip.url.split('/').pop()}`,
          attribution: "Français Interactif (COERLL, UT Austin), CC BY 3.0",
        });
        insertBlob.run({ audio_id: aid, bytes: readFileSync(clip.file) });
        withAudio++;
      }
      insertTopic.run({
        id: grammarId('fr', SOURCE_ID, d.page.code),
        code: d.page.code,
        title_en: d.title,
        ord: d.page.ord,
        body_md: d.body,
        // CC BY asks for a link back to the source; the audio id rides here so the reader can
        // play the recorded example without a second query shape just for grammar.
        external_links: JSON.stringify([
          { label: "Tex's French Grammar", url: `${SITE}/gr/${d.page.code}.html` },
          ...(aid ? [{ label: 'audio', url: `audio:${aid}` }] : []),
        ]),
      });
      n++;
    }
  })();

  recordRun(db, SOURCE_ID, n, inputSha);
  console.log(`  ✓ fr-grammar: ${n} topics, ${withAudio} with a recorded example`);
}
