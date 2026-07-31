/**
 * seed:en-grammar — Wikibooks "English Grammar" (CC BY-SA 4.0).
 *
 * The 0.5 roadmap row named Wikibooks "English in Use", and that is deliberately NOT what this
 * ingests. Measured, English in Use is the wrong book for this app: its own contents page says it
 * is "intended for use by native speakers of English or advanced learners", its About page records
 * that the initial text was copied from Goold Brown's 1851 grammar, and its pages still read that
 * way — `thou`, `hath`, `OBS.` and Brown's citations survive across the Syntax/Punctuation/
 * Articles chapters. Bundling 19th-century prescriptive prose into a Vietnamese-first learner app
 * would be shipping bulk, not teaching.
 *
 * Its simpler companion, "English Grammar", is modern and learner-shaped — "A noun represents a
 * person, place, thing, or idea" — so that is what ships. It is a smaller book, and honestly so:
 * thin and correct beats thick and misleading. The same v0.4 lesson keeps applying, now to
 * pedagogy rather than licences: the ledger describes a source, it does not vouch for every page.
 */
import { createHash } from 'node:crypto';
import { grammarId } from '@mls/shared';
import { recordArtifactSet } from '../../lib/download';
import { polite } from '../../lib/politeness';
import { decodeHtml } from '../../lib/text';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'wikibooks-en-grammar';
const API = 'https://en.wikibooks.org/w/api.php';
const BOOK = 'English Grammar';
const PARSER_VERSION = 1;

/** Pages that are scaffolding or assessment rather than teaching. */
const SKIP = /\/(Basic Parts of Speech Test|Appendix A)$/i;

interface WikiPage { title: string; redirect?: boolean }

async function listPages(): Promise<string[]> {
  const url =
    `${API}?action=query&format=json&generator=allpages&gaplimit=200&prop=info` +
    `&gapprefix=${encodeURIComponent(`${BOOK}/`)}`;
  const res = await polite(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`wikibooks: HTTP ${res.status}`);
  const json = (await res.json()) as { query?: { pages?: Record<string, WikiPage> } };
  return Object.values(json.query?.pages ?? {})
    .filter((p) => p.redirect === undefined && !SKIP.test(p.title))
    .map((p) => p.title)
    .sort();
}

/**
 * Rendered HTML, not wikitext.
 *
 * Wikitext is smaller and batches 50 pages per request, but it arrives full of templates, tables
 * and `{{sfn}}` refs that each need bespoke handling. `action=parse` hands back HTML with the
 * templates already expanded, which the same conversion used for Tex's grammar can consume.
 */
async function fetchHtml(title: string): Promise<{ html: string; revid: number }> {
  const url =
    `${API}?action=parse&format=json&prop=text|revid&disableeditsection=1&disabletoc=1` +
    `&page=${encodeURIComponent(title)}`;
  const res = await polite(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`wikibooks: HTTP ${res.status} ${title}`);
  const json = (await res.json()) as { parse?: { text?: { '*': string }; revid?: number } };
  return { html: json.parse?.text?.['*'] ?? '', revid: json.parse?.revid ?? 0 };
}

function toMarkdown(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // navigation, edit furniture, footnote markers and category boxes teach nothing
    .replace(/<table[^>]*class="[^"]*(?:navbox|metadata|ambox)[^"]*"[\s\S]*?<\/table>/gi, '')
    .replace(/<sup[^>]*class="[^"]*reference[^"]*"[\s\S]*?<\/sup>/gi, '')
    .replace(/<div[^>]*class="[^"]*(?:navbox|printfooter|catlinks|mw-references)[^"]*"[\s\S]*?<\/div>/gi, '')
    .replace(/<span[^>]*class="[^"]*mw-editsection[^"]*"[\s\S]*?<\/span>/gi, '');

  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, t: string) => `\n- ${inline(t).trim()}`);
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, lv: string, t: string) => {
    const level = Math.min(Number(lv) + 1, 5);
    return `\n\n${'#'.repeat(level)} ${inline(t).trim()}\n\n`;
  });
  s = s.replace(/<\/p>|<br\s*\/?>|<\/tr>/gi, '\n');
  s = inline(s);
  return s
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function inline(s: string): string {
  return decodeHtml(
    s
      .replace(/<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>/gi, '**$1**')
      .replace(/<(?:i|em)[^>]*>([\s\S]*?)<\/(?:i|em)>/gi, '*$1*')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' '),
  );
}

export async function run(db: DB): Promise<void> {
  const titles = await listPages();
  console.log(`  ${titles.length} pages in "${BOOK}"`);

  const docs: { title: string; short: string; body: string; revid: number }[] = [];
  for (const title of titles) {
    const { html, revid } = await fetchHtml(title);
    const body = toMarkdown(html);
    if (body.length < 200) continue; //  stub
    docs.push({ title, short: title.slice(BOOK.length + 1), body, revid });
  }
  const bytes = docs.reduce((a, d) => a + d.body.length, 0);
  console.log(`  ✓ text: ${docs.length} chapters, ${(bytes / 1024).toFixed(0)} KB of markdown`);

  const hash = createHash('sha256');
  for (const d of docs) hash.update(d.title).update(String(d.revid)).update(d.body);
  const artifactSha = hash.digest('hex');
  recordArtifactSet({
    id: `wikibooks:${BOOK}`,
    url: `https://en.wikibooks.org/wiki/${encodeURIComponent(BOOK)}`,
    sha256: artifactSha,
    bytes,
    license: 'CC BY-SA 4.0 (Wikibooks contributors)',
    notes: `${docs.length} chapters; "English in Use" deliberately excluded (native-speaker oriented, 1851 source prose)`,
  });
  const inputSha = createHash('sha256').update(artifactSha).update(`parser:${PARSER_VERSION}`).digest('hex');
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ en-grammar unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'Wikibooks: English Grammar',
    url: `https://en.wikibooks.org/wiki/${encodeURIComponent(BOOK)}`,
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
    attributionText:
      'English grammar chapters from Wikibooks (en.wikibooks.org), by its contributors, licensed CC BY-SA 4.0. Adapted for this app: converted from wiki markup to plain text and trimmed of navigation. Each topic links to the page it came from, which is the attribution Wikimedia’s terms of use ask for.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  const insert = db.prepare(`
    INSERT INTO grammar_topics (id, lang, code, title_en, title_vi, level, ord, body_md, external_links, source_id)
    VALUES (@id, 'en', @code, @title_en, NULL, NULL, @ord, @body_md, @external_links, '${SOURCE_ID}')
    ON CONFLICT(id) DO UPDATE SET
      title_en = excluded.title_en, ord = excluded.ord, body_md = excluded.body_md,
      external_links = excluded.external_links`);

  let n = 0;
  db.transaction(() => {
    db.prepare(`DELETE FROM grammar_topics WHERE source_id = ?`).run(SOURCE_ID);
    for (const d of docs) {
      insert.run({
        id: grammarId('en', SOURCE_ID, d.short),
        code: d.short,
        title_en: d.short.split('/').pop() ?? d.short,
        ord: n,
        body_md: d.body,
        // The revision is part of the credit: it is what makes the attribution checkable against
        // a wiki that keeps changing after we copied from it.
        external_links: JSON.stringify([
          { label: `Wikibooks: ${d.short} (rev ${d.revid})`, url: `https://en.wikibooks.org/wiki/${encodeURIComponent(d.title)}` },
        ]),
      });
      n++;
    }
  })();

  recordRun(db, SOURCE_ID, n, inputSha);
  console.log(`  ✓ en-grammar: ${n} chapters`);
}
