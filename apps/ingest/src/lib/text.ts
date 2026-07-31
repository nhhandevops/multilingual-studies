/** Small text-format helpers shared by seed parsers. */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';

/** Async line iterator over a (possibly .gz) file — streams, never loads whole file. */
export function lines(path: string): AsyncIterable<string> {
  const raw = createReadStream(path);
  const stream = path.endsWith('.gz') ? raw.pipe(createGunzip()) : raw;
  return createInterface({ input: stream, crlfDelay: Infinity });
}

/** Minimal RFC-4180-ish CSV row splitter (handles quoted fields with commas/escaped quotes). */
export function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Full RFC-4180 CSV parse over a whole document.
 *
 * `splitCsv` works a line at a time, which silently corrupts any file whose quoted fields contain
 * newlines — and real ones do: the official HSK grammar CSV wraps multi-clause points across
 * lines, so a per-line split reads 625 broken rows where there are 573 whole ones.
 * Use this whenever the file is not known to be single-line-per-record.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\r') { /* CRLF: handled on the \n */ }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row); }
  return rows;
}

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
};

/**
 * Named HTML entities for the Latin-1 range, which older pages use instead of the character.
 * Tex's French Grammar is served as iso-8859-1 and writes `&eacute;` — decoding the bytes is
 * only half the job; without this, French text arrives full of `&eacute;` literals.
 */
const HTML_ENTITIES: Record<string, string> = {
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å', aelig: 'æ',
  ccedil: 'ç', egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë', igrave: 'ì', iacute: 'í',
  icirc: 'î', iuml: 'ï', ntilde: 'ñ', ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ',
  ouml: 'ö', oslash: 'ø', oelig: 'œ', ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü',
  yacute: 'ý', yuml: 'ÿ', szlig: 'ß', nbsp: ' ', shy: '', middot: '·', laquo: '«',
  raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', hellip: '…', ndash: '–',
  mdash: '—', deg: '°', eacutes: 'és',
};

/** Decode HTML text: named Latin-1 entities, the XML five, and numeric references. */
export function decodeHtml(s: string): string {
  const decoded = s.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) return String.fromCodePoint(parseInt(body.slice(2), 16));
    if (body.startsWith('#')) return String.fromCodePoint(Number(body.slice(1)));
    const lower = body.toLowerCase();
    if (HTML_ENTITIES[lower] !== undefined) return HTML_ENTITIES[lower]!;
    return XML_ENTITIES[m] ?? m;
  });
  // Legacy hand-written HTML omits the semicolon (`ne&nbsp pas` appears in Tex's conjugation
  // pages). Only a known set, and only when not followed by more letters, so a literal
  // ampersand in prose — "-er, -ir, & -re" — is left exactly as the author wrote it.
  return decoded.replace(/&(nbsp|amp|lt|gt|quot|eacute|egrave|agrave|ccedil|deg)(?![a-zA-Z;])/gi, (_m, name: string) =>
    HTML_ENTITIES[name.toLowerCase()] ?? XML_ENTITIES[`&${name.toLowerCase()};`] ?? _m,
  );
}
export const decodeXml = (s: string): string =>
  s.replace(/&(?:amp|lt|gt|quot|apos);|&#(\d+);|&#x([0-9a-fA-F]+);/g, (m, dec?: string, hex?: string) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return XML_ENTITIES[m] ?? m;
  });

export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const minCefr = (a: string, b: string): string =>
  CEFR_ORDER.indexOf(a as never) <= CEFR_ORDER.indexOf(b as never) ? a : b;
