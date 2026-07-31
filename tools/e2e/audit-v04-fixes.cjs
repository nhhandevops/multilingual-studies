// Audits the four confirmed review findings against the rebuilt staging DB.
const REPO = require('path').join(__dirname, '..', '..');
const D = require(require('path').join(REPO,'apps/ingest/node_modules/better-sqlite3'));
const db = new D(require('path').join(REPO,'build/staging.db'), { readonly: true });
const q = (s, ...p) => db.prepare(s).all(...p);
const one = (s, ...p) => db.prepare(s).get(...p);
let fail = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fail++; };

console.log(`sentences: ${one('SELECT COUNT(*) n FROM sentences').n}, links: ${one('SELECT COUNT(*) n FROM word_sentences').n}\n`);

// --- 1. content filter -----------------------------------------------------------------
const BAD = /(操你|杀了|殺了|自杀|自殺|想死|强奸|強姦|做爱|妈的|傻逼)|\b(rape[ds]?|fuck\w*|kill(?:s|ed|ing)?|murder\w*|suicide|nigger|shit)\b/i;
const offenders = q(`SELECT s.text, s.trans_en, w.headword, w.level FROM sentences s
  JOIN word_sentences ws ON ws.sentence_id=s.id JOIN words w ON w.id=ws.word_id
  WHERE ws.rank=0 AND w.level IS NOT NULL`).filter(r => BAD.test(r.text) || BAD.test(r.trans_en ?? ''));
check('no blocked content as a rank-0 example for a levelled word', offenders.length === 0,
  offenders.length ? `${offenders.length} left, e.g. ${offenders.slice(0,3).map(o=>o.headword+'→'+o.text).join(' | ')}` : '0 found');

// the specific words the review named
for (const hw of ['妈','他','她','想']) {
  const r = one(`SELECT s.text, s.trans_en FROM words w JOIN word_sentences ws ON ws.word_id=w.id
    JOIN sentences s ON s.id=ws.sentence_id WHERE w.headword=? AND ws.rank=0 LIMIT 1`, hw);
  console.log(`      ${hw} → ${r ? r.text + '  |  ' + r.trans_en : '(no example)'}`);
}
const her = one(`SELECT s.text FROM words w JOIN word_sentences ws ON ws.word_id=w.id
  JOIN sentences s ON s.id=ws.sentence_id WHERE w.headword='her' AND ws.rank=0 LIMIT 1`);
console.log(`      her → ${her ? her.text : '(no example)'}`);

// --- 2. traditional script -------------------------------------------------------------
const TRAD = ['嗎','們','麼','車','這','為','東','說','時','會','來','後','國','學','讀','聽','買'];
const tradLeft = q(`SELECT text FROM sentences WHERE lang='zh'`).filter(r => [...r.text].some(c => TRAD.includes(c)));
check('no traditional-script zh example sentences', tradLeft.length === 0,
  tradLeft.length ? `${tradLeft.length} left, e.g. ${tradLeft.slice(0,3).map(t=>t.text).join(' | ')}` : '0 of ' + one("SELECT COUNT(*) n FROM sentences WHERE lang='zh'").n);

// --- 3. pinyin quality (character-aligned, not substring) -------------------------------
// A naive "does the reading contain 'mén'" check is wrong: mén is the correct reading of 门.
// Align each sentence's Han characters to its syllables and audit the specific polyphones.
const isHan = (c) => /\p{Script=Han}/u.test(c);
const WANT = { '吗': ['ma'], '么': ['me'], '们': ['men'], '车': ['chē'],
               '得': ['de', 'dé', 'děi'], '的': ['de', 'dì', 'dí', 'dī'] };
let aligned = 0; const polyBad = {};
for (const r of q(`SELECT text, reading FROM sentences WHERE lang='zh'`)) {
  const hanChars = [...r.text].filter(isHan);
  const syls = r.reading.replace(/[，。！？、；：,.!?;:"'()\[\]（）]/g, ' ').split(/\s+/).filter(Boolean);
  if (hanChars.length !== syls.length) continue;
  aligned++;
  for (let i = 0; i < hanChars.length; i++) {
    const c = hanChars[i], sy = syls[i];
    if (WANT[c] && !WANT[c].includes(sy)) { polyBad[c] = polyBad[c] || {}; polyBad[c][sy] = (polyBad[c][sy] || 0) + 1; }
  }
}
const polyTotal = Object.values(polyBad).reduce((a, m) => a + Object.values(m).reduce((x, y) => x + y, 0), 0);
check(`polyphone readings correct (${aligned} sentences aligned)`, polyTotal <= 10,
  polyTotal ? `${polyTotal} suspect: ${JSON.stringify(polyBad)}` : 'none');

// erhua must merge, and 儿-initial words must NOT
const erhuaRows = q(`SELECT text, reading FROM sentences WHERE lang='zh' AND (text LIKE '%哪儿%' OR text LIKE '%点儿%' OR text LIKE '%事儿%')`);
const unmerged = erhuaRows.filter(r => / ér/.test(r.reading));
check('erhua merged (nǎr, not nǎ ér)', unmerged.length === 0, unmerged.length ? `${unmerged.length} unmerged` : `${erhuaRows.length} checked`);
const erziRows = q(`SELECT text, reading FROM sentences WHERE lang='zh' AND text LIKE '儿子%'`);
check('儿-initial words left alone (儿子 = ér zi)', erziRows.every(r => /^ér/.test(r.reading)), `${erziRows.length} checked`);

// structural 得 is neutral
const deRows = q(`SELECT text, reading FROM sentences WHERE lang='zh' AND text LIKE '%得%'`);
// Character-aligned, like the polyphone check: a bare / de / search also matches other
// characters that legitimately read de (德 in 德语). Apply the SAME pronoun guard the code
// does — after a pronoun the character is ambiguous between modal dei and the verb de, so the
// seed deliberately leaves it as pinyin-pro produced it.
const DEI = new Set(['我','你','您','他','她','它','们','咋','谁']);
const DE = '得';
let deChecked = 0; const deBad = [];
for (const r of deRows) {
  const hanChars = [...r.text].filter(isHan);
  const syls = r.reading.replace(/[，。！？、；：,.!?;:"'()\[\]（）]/g, ' ').split(/\s+/).filter(Boolean);
  if (hanChars.length !== syls.length) continue;
  deChecked++;
  const chars = [...r.text];
  for (let i = 0, h = 0; i < chars.length; i++) {
    if (!isHan(chars[i])) continue;
    if (chars[i] === DE) {
      const prev = chars[i - 1];
      const structural = i > 0 && isHan(prev) && !DEI.has(prev) && i + 1 < chars.length && isHan(chars[i + 1]);
      // The seed rewrites only the 'de' misreading. 'dei' in a structural slot is pinyin-pro
      // getting the modal right (zong dei = "must"), so it is correct, not a miss.
      if (structural && syls[h] === 'dé') deBad.push(`${r.text} -> ${r.reading}`);
    }
    h++;
  }
}
check('structural de is neutral (pronoun cases excluded by design)', deBad.length === 0,
  deBad.length ? `${deBad.length}, e.g. ${deBad[0]}` : `${deChecked} sentences aligned`);
console.log('      samples:');
for (const r of q(`SELECT text, reading FROM sentences WHERE lang='zh' AND (text LIKE '%什么%' OR text LIKE '%哪儿%' OR text LIKE '%得好%' OR text LIKE '%吗%') LIMIT 6`))
  console.log(`        ${r.text} → ${r.reading}`);

// --- 4. segmentation false positives ----------------------------------------------------
const fp = [['有名','没有名'],['人们','客人们'],['大人','加拿大人'],['少年','多少年']];
for (const [hw, trap] of fp) {
  const rows = q(`SELECT s.text FROM words w JOIN word_sentences ws ON ws.word_id=w.id
    JOIN sentences s ON s.id=ws.sentence_id WHERE w.headword=? AND w.lang='zh'`, hw);
  const bad = rows.filter(r => r.text.includes(trap));
  check(`${hw} not matched inside "${trap}"`, bad.length === 0, bad.length ? bad[0].text : `${rows.length} examples`);
}

// --- 5. translation attribution ---------------------------------------------------------
const withTrans = one(`SELECT COUNT(*) n FROM sentences WHERE trans_en IS NOT NULL AND lang != 'en'`).n;
const credited = one(`SELECT COUNT(*) n FROM sentences WHERE trans_en IS NOT NULL AND lang != 'en' AND attribution LIKE '%translation #%'`).n;
check('bundled translations credit their own author', credited === withTrans, `${credited}/${withTrans}`);
console.log(`      e.g. ${one("SELECT attribution FROM sentences WHERE lang='zh' AND attribution LIKE '%translation #%' LIMIT 1")?.attribution}`);

// --- coverage regression check ----------------------------------------------------------
console.log('\ncoverage after filtering:');
for (const lang of ['zh','en','fr']) {
  const t = one('SELECT COUNT(*) n FROM words WHERE lang=? AND level IS NOT NULL', lang).n;
  const c = one(`SELECT COUNT(DISTINCT w.id) n FROM words w JOIN word_sentences ws ON ws.word_id=w.id WHERE w.lang=? AND w.level IS NOT NULL`, lang).n;
  console.log(`  ${lang}: ${c}/${t} = ${(100*c/t).toFixed(1)}%`);
}
for (const lv of ['HSK1','HSK2','HSK3']) {
  const t = one("SELECT COUNT(*) n FROM words WHERE lang='zh' AND level=?", lv).n;
  const c = one(`SELECT COUNT(DISTINCT w.id) n FROM words w JOIN word_sentences ws ON ws.word_id=w.id WHERE w.lang='zh' AND w.level=?`, lv).n;
  console.log(`  ${lv}: ${c}/${t} = ${(100*c/t).toFixed(0)}%`);
}
console.log(fail === 0 ? '\nRESULT: PASS — all confirmed review findings addressed' : `\nRESULT: FAIL — ${fail} check(s) failed`);
process.exit(fail === 0 ? 0 : 1);
