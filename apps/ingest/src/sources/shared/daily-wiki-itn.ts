/**
 * daily:wiki-itn — the "in the news" blurbs from French and Chinese Wikipedia.
 *
 * WHY THIS SOURCE. Wikinews closed in every language on 4 May 2026, which removed the obvious
 * community-written news corpus. What remains is the main page's current-events box: 2–6
 * one-sentence blurbs per language per day, each linking to a full background article. Short,
 * factual, updated daily by large communities, and CC BY-SA — the most future-proof daily open
 * text in both languages, and a good size for a daily read next to a full news article.
 *
 * THREE CORRECTIONS TO THE LEDGER, all found by fetching rather than trusting:
 *
 *  1. The Chinese page name in docs/RESEARCH-SOURCES.md is wrong. `Portal:新闻动态` redirects to
 *     `Portal:新聞動態`, which transcludes the real content and returns half a megabyte with 778
 *     list items — and reports its OWN revision id, which would be a misleading attribution for
 *     text that lives elsewhere. `Template:Itn` is the actual content page: 5 items, and a revid
 *     that means what it says.
 *  2. The French list nests. One top-level entry can hold a sub-list of two separate events, and
 *     that entry's own sentence is empty — it is nothing but the date. Splitting `<li>` with a
 *     flat regex yields phantom items; splitting only at depth 0 yields a blurb with no text.
 *     Sub-items are emitted as their own blurbs, inheriting the parent's date.
 *  3. Under `variant=zh-cn` the LINK TARGETS stay traditional while the `title` attributes are
 *     converted (`href="/wiki/熊本縣"` with `title="熊本县"`). Displaying a title decoded from the
 *     href would put traditional characters into a simplified-only app. Use the attribute.
 *
 * The licence is fetched, not remembered: `meta=siteinfo&siprop=rightsinfo` returns each wiki's
 * own statement, which is what goes in the `sources` row.
 */
import { decodeHtml } from '../../lib/text';
import { polite } from '../../lib/politeness';
import { writeDailyItems, type DailyItem } from '../../lib/daily';
import { levelEstimator } from '../../lib/level';
import { registerSource, recordRun, type DB } from '../../lib/staging';

const SOURCE_ID = 'wikipedia-itn';

interface Wiki {
  lang: 'fr' | 'zh';
  host: string;
  page: string;
  /** Extra query params (Chinese needs script-variant conversion). */
  extra: string;
  /** Where the blurb list starts in the parsed HTML. */
  anchor: RegExp;
  /** Where it ends, when the page continues with unrelated sections. */
  stop?: RegExp;
}

const WIKIS: Wiki[] = [
  {
    lang: 'fr',
    host: 'https://fr.wikipedia.org',
    page: 'Modèle:Accueil actualité',
    extra: '',
    // The id arrives HTML-entity-encoded: id="cadre&#95;apercu&#95;actualite".
    anchor: /id="cadre(?:&#95;|_)apercu(?:&#95;|_)actualite"/i,
    stop: /<hr class="accueil-actualites-separation"/i,
  },
  {
    lang: 'zh',
    host: 'https://zh.wikipedia.org',
    page: 'Template:Itn',
    extra: '&variant=zh-cn',
    anchor: /<div id="column-itn"/i,
    stop: /<div id="column-feature-more"/i,
  },
];

export interface DailyResult {
  source: string;
  lang: string;
  stored: number;
  skipped: { url: string; why: string }[];
}

export async function run(db: DB, opts: { date: string }): Promise<DailyResult[]> {
  const rights = await fetchRights(WIKIS[0]!.host);
  const rightsZh = await fetchRights(WIKIS[1]!.host);
  // Compare the licences themselves, not the URLs verbatim: each wiki links its own LOCALISED
  // deed — .../by-sa/4.0/deed.fr against .../by-sa/4.0/deed.zh — which is the same licence in two
  // languages. Comparing raw strings makes an agreement look like a conflict.
  if (canonicalLicense(rights.url) !== canonicalLicense(rightsZh.url)) {
    throw new Error(`wiki-itn: the two wikis report different licences (${rights.url} vs ${rightsZh.url})`);
  }
  const licenseUrl = canonicalLicense(rights.url);

  registerSource(db, {
    id: SOURCE_ID,
    name: 'Wikipedia — current events (Actualités / 新闻动态)',
    url: 'https://fr.wikipedia.org/wiki/Mod%C3%A8le:Accueil_actualit%C3%A9',
    license: rights.text,
    licenseUrl,
    attributionText:
      `Current-events blurbs from French and Chinese Wikipedia, ${rights.text} (licence read from each wiki's own siteinfo, not assumed). Each blurb stores the revision it was taken from and links to the background article, which is the attribution Wikimedia's terms of use ask for. Chinese text is requested with variant=zh-cn so it arrives in simplified characters.`,
    retrievedAt: opts.date,
    licenseMode: 'bundled',
  });

  const results: DailyResult[] = [];
  for (const wiki of WIKIS) results.push(await runOne(db, wiki, opts.date, rights.text));
  return results;
}

async function runOne(db: DB, wiki: Wiki, date: string, license: string): Promise<DailyResult> {
  const skipped: { url: string; why: string }[] = [];
  const estimate = levelEstimator(db, wiki.lang);

  const api =
    `${wiki.host}/w/api.php?action=parse&page=${encodeURIComponent(wiki.page)}` +
    `&prop=text|revid&format=json&formatversion=2${wiki.extra}`;
  const res = await polite(api, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`wiki-itn ${wiki.lang}: HTTP ${res.status}`);
  const json = (await res.json()) as { parse?: { text?: string; revid?: number } };
  const html = json.parse?.text ?? '';
  const revid = json.parse?.revid ?? 0;
  if (!html) throw new Error(`wiki-itn ${wiki.lang}: empty parse response`);

  const blurbs = extractBlurbs(html, wiki);
  if (blurbs.length === 0) throw new Error(`wiki-itn ${wiki.lang}: found 0 blurbs (page shape changed?)`);

  const permalink = `${wiki.host}/w/index.php?oldid=${revid}`;
  const out: DailyItem[] = [];
  for (const b of blurbs) {
    if (!b.text || b.text.length < 12) {
      skipped.push({ url: permalink, why: 'blurb has no sentence of its own' });
      continue;
    }
    const primary = b.links[0];
    out.push({
      lang: wiki.lang,
      date,
      kind: 'news',
      slug: primary ? primary.title : b.text.slice(0, 40),
      // The bolded article names the event — but only when there is ONE of them. The Fields Medal
      // blurb bolds four mathematicians, and titling it "Yu Deng" turns an award into a person.
      // With several, the sentence is the honest headline.
      title: b.bolded === 1 && primary ? primary.title : trimTitle(b.text),
      url: primary ? `${wiki.host}${primary.href}` : permalink,
      bodyText: b.text,
      audioUrl: null,
      levelEst: estimate(b.text)?.level ?? null,
      attribution: `Wikipedia (${wiki.lang}) — ${wiki.page}, rev ${revid} (${license}) · ${permalink}`,
      publishedAt: b.date,
    });
  }

  const stored = writeDailyItems(db, SOURCE_ID, wiki.lang, date, out);
  recordRun(db, SOURCE_ID, stored);
  console.log(`  ✓ wiki-itn ${wiki.lang}: ${stored} blurbs (rev ${revid})${skipped.length ? ` (${skipped.length} skipped)` : ''}`);
  return { source: SOURCE_ID, lang: wiki.lang, stored, skipped };
}

export interface Blurb {
  text: string;
  /** The blurb's own date, when the wiki records one (French does; Chinese does not). */
  date: string | null;
  /** Background articles: the bolded one first, then the rest, in document order. */
  links: { href: string; title: string }[];
  /** How many links were bolded — one means the blurb has a single canonical subject. */
  bolded: number;
}

/** A sentence used as a headline: first clause, capitalised, never mid-word. */
function trimTitle(text: string): string {
  const clause = text.split(/[,，;；]/)[0]!.trim() || text;
  const short = clause.length <= 70 ? clause : `${clause.slice(0, 67).replace(/\s+\S*$/, '')}…`;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

export function extractBlurbs(html: string, wiki: Pick<Wiki, 'anchor' | 'stop'>): Blurb[] {
  const start = wiki.anchor.exec(html);
  if (!start) return [];
  let scope = html.slice(start.index);
  const stop = wiki.stop?.exec(scope);
  if (stop) scope = scope.slice(0, stop.index);

  const ulStart = scope.indexOf('<ul');
  if (ulStart < 0) return [];
  const ul = balanced(scope, ulStart, 'ul');

  const out: Blurb[] = [];
  for (const item of topLevelItems(ul)) {
    const date = dateOf(item);
    const nested = /<ul\b/i.exec(item);
    const ownHtml = nested ? item.slice(0, nested.index) : item;
    const own = sentenceOf(ownHtml);
    if (own.length >= 12) out.push({ text: own, date, ...linksOf(ownHtml) });
    if (nested) {
      // Sub-events inherit the parent's date: the parent carries the date and nothing else.
      for (const sub of topLevelItems(balanced(item, nested.index, 'ul'))) {
        const text = sentenceOf(sub);
        if (text.length >= 12) out.push({ text, date, ...linksOf(sub) });
      }
    }
  }
  return out;
}

/** `<li>` children at nesting depth 1 of `ul` — never those of a nested list. */
function topLevelItems(ul: string): string[] {
  const items: string[] = [];
  const re = /<(\/?)(ul|li)\b[^>]*>/gi;
  let ulDepth = 0;
  let liDepth = 0;
  let start = -1;
  for (let m = re.exec(ul); m; m = re.exec(ul)) {
    const closing = m[1] === '/';
    if (m[2]!.toLowerCase() === 'ul') {
      ulDepth += closing ? -1 : 1;
      continue;
    }
    if (!closing) {
      if (ulDepth === 1 && liDepth === 0) start = m.index + m[0].length;
      liDepth++;
    } else {
      liDepth--;
      if (ulDepth === 1 && liDepth === 0 && start >= 0) {
        items.push(ul.slice(start, m.index));
        start = -1;
      }
    }
  }
  return items;
}

function balanced(html: string, start: number, tag: string): string {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] === '/' ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  return html.slice(start);
}

const dateOf = (item: string): string | null => {
  const m = /<time[^>]*\bdatetime="(\d{4}-\d{2}-\d{2})"/i.exec(item);
  return m ? m[1]! : null;
};

/** The blurb sentence: no date prefix, no `(photo)`/（图）markers, no markup. */
function sentenceOf(itemHtml: string): string {
  const withoutTime = itemHtml.replace(/<time\b[\s\S]*?<\/time>/gi, '');
  return decodeHtml(withoutTime.replace(/<[^>]+>/g, ''))
    .replace(/^[\s ]*[:：]\s*/, '') //  the `&#160;: ` separator French puts after the date
    .replace(/[（(]\s*(?:photo|图|圖)\s*[)）]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Article links, bolded one first.
 *
 * The title ATTRIBUTE is the display text, never the href: under `variant=zh-cn` the hrefs stay
 * traditional while the titles are converted. Red links (`redlink=1`) are excluded by requiring a
 * `/wiki/` path.
 */
function linksOf(itemHtml: string): { links: { href: string; title: string }[]; bolded: number } {
  const collect = (html: string) => {
    const out: { href: string; title: string }[] = [];
    const re = /<a\b[^>]*\bhref="(\/wiki\/[^"?]+)"[^>]*\btitle="([^"]*)"/gi;
    for (let m = re.exec(html); m; m = re.exec(html)) out.push({ href: m[1]!, title: decodeHtml(m[2]!) });
    return out;
  };
  const bold = itemHtml.match(/<b\b[^>]*>[\s\S]*?<\/b>/gi) ?? [];
  const primary = bold.flatMap(collect);
  const rest = collect(itemHtml).filter((l) => !primary.some((p) => p.href === l.href));
  // Date links ("28 juillet", "Juillet 2026") are calendar navigation, not background reading.
  const isDateLink = (l: { title: string }) => /^\d{1,2}\s|^[A-ZÀ-Ý][a-zà-ÿ]+\s+\d{4}$/.test(l.title);
  return { links: [...primary, ...rest.filter((l) => !isDateLink(l))], bolded: primary.length };
}

/** `https://creativecommons.org/licenses/by-sa/4.0/deed.fr` → `…/by-sa/4.0`. */
const canonicalLicense = (url: string): string =>
  url.toLowerCase().replace(/\/deed\.[a-z_-]+\/?$/, '').replace(/\/$/, '');

/** Each wiki's own licence statement — asserted nowhere, fetched here. */
async function fetchRights(host: string): Promise<{ url: string; text: string }> {
  const res = await polite(`${host}/w/api.php?action=query&meta=siteinfo&siprop=rightsinfo&format=json&formatversion=2`, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`wiki-itn: siteinfo HTTP ${res.status} for ${host}`);
  const json = (await res.json()) as { query?: { rightsinfo?: { url?: string; text?: string } } };
  const info = json.query?.rightsinfo;
  if (!info?.url || !info.text) throw new Error(`wiki-itn: ${host} reports no rightsinfo`);
  return { url: info.url, text: info.text };
}
