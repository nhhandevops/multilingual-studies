/**
 * seed:tech-vocab — the IoT/professional vocabulary module.
 *
 * One row per curated concept (see terms.ts): an English definition, its Chinese/French/
 * Vietnamese names, and per-term provenance. Three sources feed it, each doing the one thing it
 * is good at:
 *   Wikipedia glossaries → one-sentence plain-English definitions (EEE median 92 chars)
 *   NIST CSRC           → authoritative definitions where the glossaries have none (public domain)
 *   Wikipedia article intro → the fallback that guarantees every concept a definition
 *   Wikidata            → the zh/fr/vi labels and aliases (CC0)
 *
 * FIVE MEASURED TRAPS THIS CODE EXISTS TO AVOID (all verified live on 2026-07-31, twice —
 * probe and adversarial re-check):
 *
 *  1. WIKIDATA'S `zh` LABEL IS OFTEN TRADITIONAL (韌體 for firmware, 編譯器 for compiler —
 *     whatever script the last editor typed). A simplified-only app must request `zh-hans` with
 *     `languagefallback=1`, which really converts (编译器, with `source-language` provenance)
 *     and lifts usable simplified coverage from 25/39 to 37/39 on the probe set.
 *  2. THE FALLBACK LIES POLITELY: with languagefallback on, a missing Vietnamese label comes
 *     back as the ENGLISH string filed under the `vi` key (`{value:"edge computing",
 *     language:"en","for-language":"vi"}`). Six of 39 probed vi "labels" were that. The accept
 *     rule is: keep a label only when `language` is the requested one (or 'mul', Wikidata's
 *     explicit "this name is universal"), never when `for-language` names a language the value
 *     is not in. Storing `.value` without checking `.language` ships English as Vietnamese —
 *     well-formed and untrue, the exact shape of v0.4's licence bug.
 *  3. DISAMBIGUATION PAGES HAVE VALID QIDs. "Node" resolves happily to Q2128997 — the item for
 *     the disambiguation page — and its labels would teach the learner the Chinese for "list of
 *     things called node". `ppprop=wikibase_item|disambiguation` and reject on key presence.
 *  4. THE JOIN RESPONSE IS NOT IN REQUEST ORDER (it comes back pageid-sorted) and redirects
 *     resolve silently to nothing without `redirects=1`. Correlate by title through
 *     `normalized[]` + `redirects[]`, never by index.
 *  5. THE GLOSSARY MARKUP HAS A HATNOTE WEDGED BETWEEN `</dt>` AND `<dd>` on 38 CS entries, dt
 *     ids escape underscores as `&#95;`, and alias `<dt>` runs share one `<dd>` where only the
 *     bare-`<dfn>` dt is the alias. A nextSibling walk silently drops all of those.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { techTermId } from '@mls/shared';
import { download, recordArtifactSet } from '../../lib/download';
import { polite } from '../../lib/politeness';
import { decodeHtml } from '../../lib/text';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';
import { CONCEPTS, type TechConcept } from './terms';

const PARSER_VERSION = 3; //  3: script-screen the zh-hans label itself (mixed-script 遥測 measured)
/** ID source segment — OURS, like 'latin' for the letter skeletons. The slugs are the contract. */
const ID_SOURCE = 'iot';

const SRC_WIKIPEDIA = 'wikipedia-tech';
const SRC_NIST = 'nist-csrc';
const SRC_WIKIDATA = 'wikidata';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const NIST_ZIP = 'https://csrc.nist.gov/csrc/media/glossary/glossary-export.zip';
const NIST_META = 'https://csrc.nist.gov/csrc/media/glossary/glossary-export.meta';

const GLOSSARY_PAGES = [
  'Glossary of electrical and electronics engineering',
  'Glossary of computer hardware terms',
  'Glossary of computer science',
];

// ---------------------------------------------------------------- NIST

interface NistRecord {
  term: string;
  link?: string;
  definitions: { text?: string; sources?: { text?: string }[] }[] | null;
  abbrSyn?: { text?: string }[] | null;
}

/**
 * Minimal single-entry ZIP reader. The export is one deflate-compressed JSON file; pulling in a
 * zip dependency for that would be the heavier hack. Offsets per APPNOTE.TXT: local file header
 * is PK\x03\x04, compression method at +8, name/extra lengths at +26/+28.
 */
function unzipSingle(zip: Buffer): Buffer {
  if (zip.readUInt32LE(0) !== 0x04034b50) throw new Error('nist: not a ZIP (bad local header)');
  const method = zip.readUInt16LE(8);
  const nameLen = zip.readUInt16LE(26);
  const extraLen = zip.readUInt16LE(28);
  const start = 30 + nameLen + extraLen;
  // Sizes in the local header may be zero (data-descriptor style); the central directory always
  // has them. Find it from the end-of-central-directory record.
  const eocd = zip.lastIndexOf(Buffer.from('PK\x05\x06', 'binary'));
  if (eocd < 0) throw new Error('nist: ZIP has no end-of-central-directory');
  const cdOffset = zip.readUInt32LE(eocd + 16);
  const compSize = zip.readUInt32LE(cdOffset + 20);
  const data = zip.subarray(start, start + compSize);
  if (method === 0) return Buffer.from(data);
  if (method === 8) return inflateRawSync(data);
  throw new Error(`nist: unsupported ZIP compression method ${method}`);
}

async function loadNist(): Promise<{ byTerm: Map<string, { text: string; source: string | null }>; sha: string }> {
  const zipPath = await download({
    id: 'nist-csrc:glossary-export.zip',
    url: NIST_ZIP,
    relPath: 'tech/glossary-export.zip',
    license: 'Public domain (US government work)',
    notes: 'CSRC glossary bulk export, regenerated daily; sha256 of the inner JSON is published in glossary-export.meta',
  });
  const json = unzipSingle(readFileSync(zipPath));

  // The .meta sidecar publishes the sha256 OF THE UNZIPPED JSON (verified: it does not match the
  // zip). Integrity is checkable per NIST's own mechanism, so check it — a truncated download
  // must fail here, not parse as half a glossary.
  const metaRes = await polite(NIST_META);
  if (metaRes.ok) {
    const meta = await metaRes.text();
    const expect = /sha256:\s*([0-9A-Fa-f]{64})/.exec(meta)?.[1]?.toLowerCase();
    const actual = createHash('sha256').update(json).digest('hex');
    if (expect && expect !== actual) {
      throw new Error(`nist: export sha256 mismatch (meta ${expect.slice(0, 12)}… vs actual ${actual.slice(0, 12)}…) — delete data-cache/tech/glossary-export.zip and re-run`);
    }
  }

  // UTF-8 BOM, measured — JSON.parse rejects it.
  const text = json.toString('utf8').replace(/^﻿/, '');
  const parsed = JSON.parse(text) as { totalRecords: number; parentTerms: NistRecord[] };
  const byTerm = new Map<string, { text: string; source: string | null }>();
  for (const rec of parsed.parentTerms) {
    const def = rec.definitions?.find((d) => d.text && d.text.trim().length > 0);
    if (!def?.text) continue; //  55% of the corpus is acronym-only stubs
    const entry = { text: def.text.trim(), source: def.sources?.[0]?.text?.trim() ?? null };
    // Index the record under its own term always, but under its abbrSyn expansions ONLY when
    // there is exactly one. An acronym record can list several UNRELATED expansions — measured:
    // "WAP" carries [Web Application Proxy, Wireless Access Point, Wireless Application Protocol]
    // while its definition defines only the last — and expanding all of them filed a definition
    // of the Wireless Application Protocol under "wireless access point".
    const abbr = (rec.abbrSyn ?? []).map((a) => a.text ?? '').filter(Boolean);
    const keys = [rec.term, ...(abbr.length === 1 ? abbr : [])];
    for (const k of keys) {
      const key = k.trim().toLowerCase();
      if (key && !byTerm.has(key)) byTerm.set(key, entry);
    }
  }
  console.log(`  NIST: ${parsed.totalRecords} records, ${byTerm.size} lookup keys with definitions`);
  return { byTerm, sha: createHash('sha256').update(json).digest('hex') };
}

// ---------------------------------------------------------------- Wikipedia glossaries

interface GlossaryDef {
  text: string;
  page: string;
  revid: number;
  /** /wiki/Article the term's <dfn> links to — the strong join key. */
  article: string | null;
  term: string;
}

/**
 * dt/dd extraction that survives the measured markup:
 * token-walk the <dt>/<dd>/<p class=glossary-hatnote> sequence (never nextSibling), let every
 * bare-<dfn> dt in a run share the run's <dd> (they are aliases), and drop a LINKED dt left
 * without a dd (it is a genuinely undefined term, not an alias — "task manager" on the HW page).
 */
export function parseGlossary(html: string, page: string, revid: number): GlossaryDef[] {
  const out: GlossaryDef[] = [];
  const tokens = html.match(/<dt\b[\s\S]*?<\/dt>|<dd\b[\s\S]*?<\/dd>/gi) ?? [];
  let run: { term: string; article: string | null }[] = [];
  for (const tok of tokens) {
    if (/^<dt/i.test(tok)) {
      const article = /<a\s[^>]*href="\/wiki\/([^"#?]+)"/i.exec(tok)?.[1] ?? null;
      const term = cleanInline(/<dfn[^>]*>([\s\S]*?)<\/dfn>/i.exec(tok)?.[1] ?? tok);
      if (term) run.push({ term, article: article ? decodeURIComponent(article).replace(/_/g, ' ') : null });
    } else {
      const text = cleanDefinition(tok);
      if (text.length >= 20) {
        for (const t of run) out.push({ text, page, revid, article: t.article, term: t.term });
      }
      run = [];
    }
  }
  return out;
}

function cleanInline(s: string): string {
  return decodeHtml(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function cleanDefinition(dd: string): string {
  const stripped = dd
    // citation superscripts: match on class="reference" — the id attribute comes first and its
    // underscores arrive escaped as &#95;, so matching on `<sup id="cite_ref` finds nothing
    .replace(/<sup[^>]*class="[^"]*\breference\b[^"]*"[\s\S]*?<\/sup>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(ul|ol|table)\b[\s\S]*?<\/\1>/gi, '');
  return cleanInline(stripped);
}

async function loadGlossaries(): Promise<{ defs: GlossaryDef[]; revids: Map<string, number> }> {
  const defs: GlossaryDef[] = [];
  const revids = new Map<string, number>();
  for (const page of GLOSSARY_PAGES) {
    const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(page)}&prop=text|revid&format=json&formatversion=2`;
    const res = await polite(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`glossary: HTTP ${res.status} for ${page}`);
    const json = (await res.json()) as { parse?: { text?: string; revid?: number } };
    const entries = parseGlossary(json.parse?.text ?? '', page, json.parse?.revid ?? 0);
    revids.set(page, json.parse?.revid ?? 0);
    defs.push(...entries);
    console.log(`  glossary "${page}": ${entries.length} definitions (rev ${json.parse?.revid})`);
  }
  return { defs, revids };
}

// ---------------------------------------------------------------- Wikipedia join + extracts

const chunk = <T,>(arr: T[], n: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));

interface JoinResult {
  qid: string | null;
  finalTitle: string; //  after normalisation + redirect
  why?: string;
}

async function joinToWikidata(titles: string[]): Promise<Map<string, JoinResult>> {
  const out = new Map<string, JoinResult>();
  for (const batch of chunk(titles, 50)) {
    const url =
      `${WIKI_API}?action=query&titles=${batch.map(encodeURIComponent).join('%7C')}` +
      `&prop=pageprops&ppprop=wikibase_item%7Cdisambiguation&redirects=1&format=json&formatversion=2`;
    const res = await polite(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`wikipedia join: HTTP ${res.status}`);
    const json = (await res.json()) as {
      query?: {
        normalized?: { from: string; to: string }[];
        redirects?: { from: string; to: string }[];
        pages?: { title: string; missing?: boolean; pageprops?: Record<string, string> }[];
      };
    };
    // Response order is pageid-sorted, not request order — walk each request title through
    // normalized[] then redirects[] to find the page that answers it.
    const normalized = new Map((json.query?.normalized ?? []).map((n) => [n.from, n.to]));
    const redirects = new Map((json.query?.redirects ?? []).map((r) => [r.from, r.to]));
    const pages = new Map((json.query?.pages ?? []).map((p) => [p.title, p]));
    for (const requested of batch) {
      let title = normalized.get(requested) ?? requested;
      title = redirects.get(title) ?? title;
      const page = pages.get(title);
      if (!page || page.missing) {
        out.set(requested, { qid: null, finalTitle: title, why: 'no article' });
      } else if (page.pageprops && 'disambiguation' in page.pageprops) {
        // A disambiguation page has a perfectly valid QID — for the disambiguation page itself.
        out.set(requested, { qid: null, finalTitle: title, why: 'disambiguation page' });
      } else if (!page.pageprops?.['wikibase_item']) {
        out.set(requested, { qid: null, finalTitle: title, why: 'no wikidata item' });
      } else {
        out.set(requested, { qid: page.pageprops['wikibase_item'], finalTitle: title });
      }
    }
  }
  return out;
}

/** Intro extracts — the definition of last resort; every concept has an article by construction. */
async function loadExtracts(titles: string[]): Promise<Map<string, { text: string; revid: number }>> {
  const out = new Map<string, { text: string; revid: number }>();
  // exintro forces exlimit ≤ 20
  for (const batch of chunk(titles, 20)) {
    const url =
      `${WIKI_API}?action=query&titles=${batch.map(encodeURIComponent).join('%7C')}` +
      `&prop=extracts%7Cinfo&exintro=1&explaintext=1&redirects=1&format=json&formatversion=2`;
    const res = await polite(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`wikipedia extracts: HTTP ${res.status}`);
    const json = (await res.json()) as {
      query?: {
        normalized?: { from: string; to: string }[];
        redirects?: { from: string; to: string }[];
        pages?: { title: string; extract?: string; lastrevid?: number }[];
      };
    };
    const normalized = new Map((json.query?.normalized ?? []).map((n) => [n.from, n.to]));
    const redirects = new Map((json.query?.redirects ?? []).map((r) => [r.from, r.to]));
    const pages = new Map((json.query?.pages ?? []).map((p) => [p.title, p]));
    for (const requested of batch) {
      let title = normalized.get(requested) ?? requested;
      title = redirects.get(title) ?? title;
      const page = pages.get(title);
      if (!page?.extract) continue;
      out.set(requested, { text: firstSentences(page.extract, 2, 420), revid: page.lastrevid ?? 0 });
    }
  }
  return out;
}

/**
 * First N sentences, capped — an intro can run to paragraphs and a card wants a definition.
 *
 * Split points are period-then-space-then-capital, NOT every period: NIST prose is full of
 * "(e.g., federal buildings…)" and "1) … 2) …", and a naive `[^.]+\.` matcher fails at "e.g.,"
 * then restarts mid-sentence — the shipped result began "​, federal buildings, military
 * establishments…". Measured, not hypothetical.
 */
export function firstSentences(text: string, n: number, maxChars: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const parts = clean.split(/(?<=[.!?])\s+(?=[A-Z0-9("'])/);
  let out = '';
  for (const p of parts.slice(0, n)) {
    if (out.length > 0 && out.length + p.length > maxChars) break;
    out += (out ? ' ' : '') + p;
  }
  if (!out) out = clean;
  return out.length > maxChars ? `${out.slice(0, maxChars - 1).replace(/\s+\S*$/, '')}…` : out;
}

// ---------------------------------------------------------------- Wikidata labels

interface LabelValue {
  value: string;
  language: string;
  'source-language'?: string;
  'for-language'?: string;
}

interface Entity {
  labels?: Record<string, LabelValue>;
  aliases?: Record<string, { value: string }[]>;
}

export interface TermLabels {
  zh: string | null;
  fr: string | null;
  vi: string | null;
  aliases: { zh: string[]; fr: string[]; vi: string[] };
}

/**
 * The accept rule, verbatim from what the API actually does:
 *  - `language === requested`  → real label (this KEEPS zh-hans script conversions, which stay
 *    `language:"zh-hans"` and add `source-language` provenance);
 *  - `language === 'mul'`      → Wikidata's explicit "this name is identical in every language"
 *    (Wi-Fi). Accepted: "Wi-Fi" genuinely is the word in Vietnamese and Chinese usage, and
 *    rejecting it would render the row as a gap that is not really there;
 *  - anything else             → the fallback substituted a DIFFERENT language's text (six of 39
 *    probed vi labels were English). Treat as missing.
 */
const acceptLabel = (l: LabelValue | undefined, requested: string): string | null =>
  l && (l.language === requested || l.language === 'mul') ? l.value : null;

async function loadLabels(qids: string[]): Promise<{ byQid: Map<string, Entity>; sha: string }> {
  const byQid = new Map<string, Entity>();
  const hash = createHash('sha256');
  for (const batch of chunk(qids, 50)) {
    const url =
      `${WIKIDATA_API}?action=wbgetentities&ids=${batch.join('%7C')}` +
      `&props=labels%7Caliases&languages=en%7Czh%7Czh-hans%7Cfr%7Cvi&languagefallback=1&format=json&formatversion=2`;
    const res = await polite(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`wikidata: HTTP ${res.status}`);
    const text = await res.text();
    hash.update(text);
    const json = JSON.parse(text) as { entities?: Record<string, Entity> };
    for (const [qid, e] of Object.entries(json.entities ?? {})) byQid.set(qid, e);
  }
  return { byQid, sha: hash.digest('hex') };
}

function extractLabels(e: Entity, isTraditional: (s: string) => boolean): TermLabels {
  const aliasesOf = (lang: string) => (e.aliases?.[lang] ?? []).map((a) => a.value);
  // zh text arrives in whichever script its editor used (韌體 beside 固件). The app is
  // simplified-only, so traditional-carrying strings are dropped — using the same lexicon-derived
  // traditional-only character set v0.4 built to filter Tatoeba, not a hardcoded list.
  const zhAliases = [...new Set([...aliasesOf('zh-hans'), ...aliasesOf('zh')])].filter((a) => !isTraditional(a));
  // The LABEL gets the same screen as the aliases. `zh-hans` sounds like a guarantee and is not
  // one: it is an editor-typed field, and a PRESENT zh-hans label is served untouched — measured,
  // telemetry's zh-hans label is the mixed-script "遥測". When the label fails the screen, the
  // first clean alias is promoted; failing that, the term ships without a Chinese name.
  let zh = acceptLabel(e.labels?.['zh-hans'], 'zh-hans');
  if (zh && isTraditional(zh)) zh = zhAliases[0] ?? null;
  return {
    zh,
    fr: acceptLabel(e.labels?.['fr'], 'fr'),
    vi: acceptLabel(e.labels?.['vi'], 'vi'),
    aliases: {
      zh: zhAliases.filter((a) => a !== zh),
      fr: aliasesOf('fr'),
      vi: aliasesOf('vi'),
    },
  };
}

/** Characters that occur in our zh lexicon's alt_form (traditional) but never in a headword. */
function traditionalDetector(db: DB): (s: string) => boolean {
  const simp = new Set<string>();
  const trad = new Set<string>();
  for (const row of db.prepare(`SELECT headword, alt_form FROM words WHERE lang = 'zh'`).all() as {
    headword: string;
    alt_form: string | null;
  }[]) {
    for (const ch of row.headword) simp.add(ch);
    for (const ch of row.alt_form ?? '') trad.add(ch);
  }
  const tradOnly = new Set([...trad].filter((ch) => !simp.has(ch)));
  return (s: string) => [...s].some((ch) => tradOnly.has(ch));
}

// ---------------------------------------------------------------- run

export async function run(db: DB): Promise<void> {
  const titles = CONCEPTS.map((t) => t.title);
  console.log(`  ${CONCEPTS.length} curated concepts`);

  const [nist, glossaries, joins] = [await loadNist(), await loadGlossaries(), await joinToWikidata(titles)];

  const failed = CONCEPTS.filter((t) => !joins.get(t.title)?.qid);
  for (const f of failed) console.log(`  ! ${f.title}: ${joins.get(f.title)?.why ?? 'join failed'}`);
  const joined = CONCEPTS.filter((t) => joins.get(t.title)?.qid);

  const { byQid, sha: entitySha } = await loadLabels(joined.map((t) => joins.get(t.title)!.qid!));
  const extracts = await loadExtracts(titles);

  const isTraditional = traditionalDetector(db);
  const glossaryByArticle = new Map<string, GlossaryDef>();
  const glossaryByTerm = new Map<string, GlossaryDef>();
  for (const g of glossaries.defs) {
    if (g.article && !glossaryByArticle.has(g.article.toLowerCase())) glossaryByArticle.set(g.article.toLowerCase(), g);
    if (!glossaryByTerm.has(g.term.toLowerCase())) glossaryByTerm.set(g.term.toLowerCase(), g);
  }

  interface Built {
    concept: TechConcept;
    qid: string;
    definition: string;
    sourceId: string;
    attribution: string;
    labels: TermLabels;
  }
  const built: Built[] = [];
  const provenance = { glossary: 0, nist: 0, extract: 0 };
  for (const concept of joined) {
    const join = joins.get(concept.title)!;
    const qid = join.qid!;
    const entity = byQid.get(qid);
    const labels = entity ? extractLabels(entity, isTraditional) : { zh: null, fr: null, vi: null, aliases: { zh: [], fr: [], vi: [] } };
    const labelCredit = `Labels: Wikidata ${qid} (CC0)`;

    // Definition chain: glossary (best learner prose) → NIST (authoritative) → intro extract
    // (guaranteed). Provenance rides on the row either way.
    const glossary =
      glossaryByArticle.get(join.finalTitle.toLowerCase()) ?? glossaryByTerm.get(concept.title.toLowerCase());
    const nistHit = nist.byTerm.get(concept.title.toLowerCase()) ?? nist.byTerm.get(concept.slug.replace(/-/g, ' '));
    const extract = extracts.get(concept.title);
    let definition: string, sourceId: string, attribution: string;
    if (glossary) {
      definition = glossary.text;
      sourceId = SRC_WIKIPEDIA;
      attribution = `Definition: Wikipedia, “${glossary.page}” (rev ${glossary.revid}), CC BY-SA 4.0 · ${labelCredit}`;
      provenance.glossary++;
    } else if (nistHit) {
      definition = firstSentences(nistHit.text, 3, 500);
      sourceId = SRC_NIST;
      attribution = `Definition: NIST CSRC Glossary${nistHit.source ? `, from ${nistHit.source}` : ''} — public domain · ${labelCredit}`;
      provenance.nist++;
    } else if (extract) {
      definition = extract.text;
      sourceId = SRC_WIKIPEDIA;
      attribution = `Definition: Wikipedia, “${join.finalTitle}” (rev ${extract.revid}), CC BY-SA 4.0 · ${labelCredit}`;
      provenance.extract++;
    } else {
      console.log(`  ! ${concept.title}: no definition from any source, skipped`);
      continue;
    }
    built.push({ concept, qid, definition, sourceId, attribution, labels });
  }

  const viCount = built.filter((b) => b.labels.vi).length;
  const zhCount = built.filter((b) => b.labels.zh).length;
  const frCount = built.filter((b) => b.labels.fr).length;
  console.log(`  ✓ built ${built.length}/${CONCEPTS.length} terms`);
  console.log(`    definitions: glossary ${provenance.glossary} · NIST ${provenance.nist} · article intro ${provenance.extract}`);
  console.log(`    labels: zh ${zhCount}/${built.length} · fr ${frCount}/${built.length} · vi ${viCount}/${built.length} (gaps ship as gaps)`);

  const hash = createHash('sha256');
  for (const b of built) {
    hash.update(b.concept.slug).update(b.qid).update(b.definition).update(JSON.stringify(b.labels));
  }
  const artifactSha = hash.digest('hex');
  recordArtifactSet({
    id: 'tech-vocab:compiled',
    url: 'https://www.wikidata.org/',
    sha256: artifactSha,
    bytes: built.reduce((a, b) => a + b.definition.length, 0),
    license: 'Definitions: CC BY-SA 4.0 (Wikipedia) / public domain (NIST) per row; labels: CC0 (Wikidata)',
    notes: `${built.length} terms; glossary revids: ${[...glossaries.revids.values()].join(', ')}; entity payload sha ${entitySha.slice(0, 12)}; NIST sha ${nist.sha.slice(0, 12)}`,
  });
  const inputSha = createHash('sha256').update(artifactSha).update(`parser:${PARSER_VERSION}`).digest('hex');
  if (alreadyIngested(db, 'tech-vocab', inputSha)) {
    console.log('  ✓ tech-vocab unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SRC_WIKIPEDIA,
    name: 'Wikipedia (technical glossaries & articles)',
    url: 'https://en.wikipedia.org/wiki/Glossary_of_electrical_and_electronics_engineering',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
    attributionText:
      'Technical definitions from English Wikipedia — the glossaries of electrical and electronics engineering, computer hardware and computer science, and article introductions — by their contributors, CC BY-SA 4.0. Each term’s row cites the page and revision its definition came from.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });
  registerSource(db, {
    id: SRC_NIST,
    name: 'NIST CSRC Glossary',
    url: 'https://csrc.nist.gov/glossary',
    license: 'Public domain (US government work)',
    licenseUrl: 'https://www.nist.gov/oism/copyrights',
    attributionText:
      'Definitions from the NIST Computer Security Resource Center glossary (csrc.nist.gov/glossary), a US-government work in the public domain. NIST asks that the source publication be cited; each term’s row names it. The glossary aggregates NISTIR 7298r3 and the SP 800 series.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });
  registerSource(db, {
    id: SRC_WIKIDATA,
    name: 'Wikidata (multilingual labels)',
    url: 'https://www.wikidata.org/',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionText:
      'Chinese, French and Vietnamese names and aliases for technical terms from Wikidata. All structured data in Wikidata’s main namespace — which includes item labels and aliases — is published under CC0. Simplified Chinese is requested as zh-hans with language fallback, and a label is stored only when it is actually in the requested language (Wikidata otherwise substitutes English silently); each term’s row records its item id.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  const insertTerm = db.prepare(`
    INSERT INTO tech_terms (id, term, definition, domain, source_id, attribution, wikidata_qid)
    VALUES (@id, @term, @definition, @domain, @source_id, @attribution, @wikidata_qid)
    ON CONFLICT(id) DO UPDATE SET
      term = excluded.term, definition = excluded.definition, domain = excluded.domain,
      source_id = excluded.source_id, attribution = excluded.attribution,
      wikidata_qid = excluded.wikidata_qid`);
  const insertLabel = db.prepare(`
    INSERT INTO tech_term_labels (term_id, lang, label, aliases)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(term_id, lang) DO UPDATE SET label = excluded.label, aliases = excluded.aliases`);

  let n = 0;
  db.transaction(() => {
    // This module is the only writer of both tables, so clearing them outright is the
    // delete-before-insert rule (v0.4) without needing a source_id scope.
    db.prepare(`DELETE FROM tech_term_labels`).run();
    db.prepare(`DELETE FROM tech_terms`).run();
    for (const b of built) {
      const id = techTermId(ID_SOURCE, b.concept.slug);
      insertTerm.run({
        id,
        term: b.concept.title.replace(/ \([^)]+\)$/, ''), //  display: no disambiguation suffix
        definition: b.definition,
        domain: b.concept.domain,
        source_id: b.sourceId,
        attribution: b.attribution,
        wikidata_qid: b.qid,
      });
      for (const lang of ['zh', 'fr', 'vi'] as const) {
        const label = b.labels[lang];
        if (!label) continue; //  a gap ships as a gap, never as an English placeholder
        const aliases = b.labels.aliases[lang].filter((a) => a !== label);
        insertLabel.run(id, lang, label, aliases.length ? JSON.stringify(aliases.slice(0, 6)) : null);
      }
      n++;
    }
  })();

  recordRun(db, 'tech-vocab', n, inputSha);
  console.log(`  ✓ tech-vocab: ${n} terms`);
}
