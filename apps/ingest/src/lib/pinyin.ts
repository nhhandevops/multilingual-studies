/**
 * CC-CEDICT numbered pinyin → tone-marked pinyin ("ni3 hao3" → "nǐ hǎo").
 * Handles u: → ü, erhua "r5", neutral tone (5/0 = no mark), uppercase initials (Bei3 → Běi).
 */

const MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à'], e: ['ē', 'é', 'ě', 'è'], i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'], u: ['ū', 'ú', 'ǔ', 'ù'], ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
  A: ['Ā', 'Á', 'Ǎ', 'À'], E: ['Ē', 'É', 'Ě', 'È'], O: ['Ō', 'Ó', 'Ǒ', 'Ò'],
  U: ['Ū', 'Ú', 'Ǔ', 'Ù'], I: ['Ī', 'Í', 'Ǐ', 'Ì'], Ü: ['Ǖ', 'Ǘ', 'Ǚ', 'Ǜ'],
};

function markSyllable(syllable: string): string {
  const m = /^([A-Za-zü:ÜA-Z]+)([1-5])$/.exec(syllable);
  if (!m) return syllable; // punctuation, '·', already-marked, etc.
  let body = m[1]!.replace(/u:/g, 'ü').replace(/U:/g, 'Ü');
  const tone = Number(m[2]!);
  if (tone === 5) return body; // neutral tone
  const idx = tone - 1;

  const mark = (ch: string): string | null => {
    const table = MARKS[ch];
    return table ? table[idx]! : null;
  };

  // Placement rule: a > e > 'ou' gets o > otherwise last vowel.
  for (const target of ['a', 'A', 'e', 'E']) {
    const i = body.indexOf(target);
    if (i >= 0) return body.slice(0, i) + mark(target) + body.slice(i + 1);
  }
  const ou = body.toLowerCase().indexOf('ou');
  if (ou >= 0) return body.slice(0, ou) + mark(body[ou]!) + body.slice(ou + 1);
  for (let i = body.length - 1; i >= 0; i--) {
    const marked = mark(body[i]!);
    if (marked) return body.slice(0, i) + marked + body.slice(i + 1);
  }
  return body; // no vowel (e.g. "m2", "hng5" edge cases) — leave unmarked
}

export function numberedToMarked(pinyin: string): string {
  return pinyin.split(/\s+/).map(markSyllable).join(' ');
}

/** Normalized key form for stable IDs: lowercase, ü not "u:", '-' separated, no tone loss. */
export function pinyinKey(pinyin: string): string {
  return pinyin.trim().toLowerCase().replace(/u:/g, 'ü').replace(/\s+/g, '-');
}
