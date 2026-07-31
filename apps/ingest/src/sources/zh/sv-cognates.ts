/**
 * seed:sv-cognates — fill `words.sv_cognate` for Chinese words with ATTESTED Sino-Vietnamese
 * cognates from the Vietnamese Wiktionary extract (kaikki.org, CC BY-SA 4.0 + GFDL).
 *
 * WHAT "COGNATE" MEANS HERE, precisely: a Vietnamese word whose own dictionary entry records
 * "Sino-Vietnamese word from X" where X is this Chinese word. Both facts matter — the Vietnamese
 * word EXISTS (it has an entry), and its descent from this exact word is ATTESTED (the
 * `vi-etym-sino` etymology template says so). ~60% of Vietnamese vocabulary is Sino-Vietnamese;
 * for a Vietnamese learner of Chinese these pairs are the single biggest discount in the
 * language, which is why `sv_cognate` has been in the schema since v0.1 waiting for a source
 * that could fill it honestly.
 *
 * WHAT WAS REJECTED, and why — both measured on our own 3,034 levelled characters before this
 * design was chosen:
 *  - COMPOSING per-character Hán-Việt readings. 手机 composes to "thủ cơ" and 老师 to "lão sư";
 *    real Vietnamese says điện thoại (di động) and giáo viên. A composed reading is a READING,
 *    not a word — teaching it as a cognate would mislead exactly the way the v0.6 tip
 *    "âm Hán Việt cũng đánh lừa bạn" warns about. Attested words only.
 *  - UNIHAN kVietnamese as the reading source. Measured: 8,306 entries, 68% coverage of our
 *    characters — with 電 (điện!), 学, 愛, 兒 simply absent, and Nôm readings mixed in with no
 *    marker. The ledger's [RECOMMENDED] describes its radical/stroke data; its Vietnamese field
 *    does not survive contact with our data. The ledger describes a source; it does not vouch
 *    for every field of it.
 *
 * THE TEMPLATE-ARGS TRAP (measured): `vi-etym-sino` carries its source in NUMBERED ARGS THAT MAY
 * BE COMPONENTS — ngân hàng is {1:"銀",2:"行"}, đại học is {1:"大學"}. Reading arg 1 alone both
 * MISSES compound-encoded words (ngân hàng, chính phủ, công ti…) and MIS-ATTACHES derived words
 * (điện thoại viên landed on 电话 via its first component). The source word is the concatenation
 * of all Han-carrying args. Also: match on the TEMPLATE, never the etymology text — the corpus
 * contains "NON-Sino-Vietnamese reading of…" sentences that a text regex happily matches.
 */
import { download, sha256File } from '../../lib/download';
import { lines } from '../../lib/text';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'kaikki-vi-en';
const URL = 'https://kaikki.org/dictionary/Vietnamese/kaikki.org-dictionary-Vietnamese.jsonl.gz';
const PARSER_VERSION = 1;

interface KaikkiEntry {
  word?: string;
  pos?: string;
  etymology_templates?: { name?: string; args?: Record<string, unknown> }[];
}

/** The Chinese source word a `vi-etym-sino` template attests, or null. */
export function sinoSource(templates: KaikkiEntry['etymology_templates']): string | null {
  for (const t of templates ?? []) {
    if (t.name !== 'vi-etym-sino') continue;
    const src = Object.keys(t.args ?? {})
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => t.args![k])
      .filter((v): v is string => typeof v === 'string' && /[一-鿿]/.test(v))
      .join('');
    return src || null;
  }
  return null;
}

/**
 * One display string from the attested variants.
 * Entries arrive in editorial duplicates ("đại học" beside "Đại Học"); prefer the lowercase
 * common-noun form, then the shortest — proper-noun casings and long derivations are real
 * entries but the wrong hint for a vocabulary card.
 */
export function pickCognate(variants: string[]): string {
  const seen = new Map<string, string>();
  for (const v of variants) {
    const key = v.toLowerCase();
    const cur = seen.get(key);
    if (!cur || (v === key && cur !== key)) seen.set(key, v); //  lowercase form wins its casefold
  }
  return [...seen.values()].sort((a, b) => {
    const aLower = a === a.toLowerCase() ? 0 : 1;
    const bLower = b === b.toLowerCase() ? 0 : 1;
    return aLower - bLower || a.length - b.length || a.localeCompare(b);
  })[0]!;
}

export async function run(db: DB): Promise<void> {
  const path = await download({
    id: 'kaikki:dictionary-Vietnamese.jsonl.gz',
    url: URL,
    relPath: 'vi/kaikki.org-dictionary-Vietnamese.jsonl.gz',
    license: 'CC BY-SA 4.0 + GFDL (Wiktionary content, wiktextract by Tatu Ylonen)',
  });
  const inputSha = `${sha256File(path)}:parser${PARSER_VERSION}`;
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ sv-cognates unchanged, skipping');
    return;
  }

  // vi word → attested Chinese sources (in Wiktionary's traditional-script convention)
  const pairs: { vi: string; zh: string }[] = [];
  let entries = 0;
  for await (const line of lines(path)) {
    if (!line.trim()) continue;
    let e: KaikkiEntry;
    try {
      e = JSON.parse(line) as KaikkiEntry;
    } catch {
      continue;
    }
    entries++;
    const src = sinoSource(e.etymology_templates);
    if (src && e.word) pairs.push({ vi: e.word, zh: src });
  }
  console.log(`  ${entries} Vietnamese entries, ${pairs.length} with an attested Sino-Vietnamese source`);

  registerSource(db, {
    id: SOURCE_ID,
    name: 'Wiktionary (Vietnamese entries, via kaikki.org)',
    url: 'https://kaikki.org/dictionary/Vietnamese/',
    license: 'CC BY-SA 4.0 + GFDL',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attributionText:
      'Sino-Vietnamese cognates from the English Wiktionary’s Vietnamese entries, extracted by kaikki.org (wiktextract, Tatu Ylonen), CC BY-SA 4.0 + GFDL. A cognate is stored only when the Vietnamese word’s own entry attests its descent from that exact Chinese word — composed per-character readings are deliberately not used, because a reading that composes is not a word that exists.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  // Wiktionary writes sources in traditional script; our headwords are simplified with the
  // traditional form in alt_form. Try traditional first, then simplified (some sources are
  // script-invariant). One full-table read into maps — a per-pair SELECT against the unindexed
  // alt_form column is a 147k-row scan × 13,866 pairs, which ran past a ten-minute timeout
  // before this was measured and rewritten.
  const byTrad = new Map<string, string>();
  const bySimp = new Map<string, string>();
  for (const r of db.prepare(`SELECT id, headword, alt_form FROM words WHERE lang = 'zh'`).iterate() as Iterable<{
    id: string;
    headword: string;
    alt_form: string | null;
  }>) {
    if (r.alt_form && !byTrad.has(r.alt_form)) byTrad.set(r.alt_form, r.id);
    if (!bySimp.has(r.headword)) bySimp.set(r.headword, r.id);
  }
  const variants = new Map<string, string[]>(); //  word id → vi variants
  for (const p of pairs) {
    const id = byTrad.get(p.zh) ?? bySimp.get(p.zh);
    if (!id) continue;
    const list = variants.get(id) ?? [];
    list.push(p.vi);
    variants.set(id, list);
  }

  let n = 0;
  db.transaction(() => {
    // Selection can change between runs (an upstream retraction must clear the row) — the same
    // delete-before-insert rule every re-runnable seed follows.
    db.prepare(`UPDATE words SET sv_cognate = NULL WHERE lang = 'zh' AND sv_cognate IS NOT NULL`).run();
    const set = db.prepare(`UPDATE words SET sv_cognate = ? WHERE id = ?`);
    for (const [id, list] of variants) {
      set.run(pickCognate(list), id);
      n++;
    }
  })();

  recordRun(db, SOURCE_ID, n, inputSha);
  const byLevel = db
    .prepare(
      `SELECT level, COUNT(*) AS t, SUM(sv_cognate IS NOT NULL) AS c FROM words
        WHERE lang = 'zh' AND level IS NOT NULL GROUP BY level ORDER BY level`,
    )
    .all() as { level: string; t: number; c: number }[];
  console.log(`  ✓ sv-cognates: ${n} zh words gained an attested cognate`);
  console.log(`    ${byLevel.map((r) => `${r.level} ${r.c}/${r.t}`).join(' · ')}`);
}
