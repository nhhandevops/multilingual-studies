/**
 * Difficulty estimation for free-running text, measured against the pack's own levelled lexicon.
 *
 * WHY THIS EXISTS AND WHAT IT IS NOT. The 0.6 row promises "news at level", but none of the fresh
 * sources grades itself: VOA Chinese is native-register news, Global Voices is journalistic B1-C1
 * prose, and Wikipedia's blurbs are encyclopedic one-liners. v0.5's rule was to leave `level` NULL
 * rather than invent a CEFR band, and inventing one here would be the same mistake.
 *
 * So this is not a CEFR grading and must never be displayed as one. It is a COVERAGE measure over
 * data we already ship: "at this band, 90% of the words in this text that we know at all are words
 * the learner has met." That is a real, reproducible number derived from the same HSK and CEFR
 * lists the rest of the app browses by — and it is honest about its own limits:
 *
 *  - it returns null when fewer than half the tokens are in our lexicon at all, because a text
 *    made mostly of proper nouns and technical terms is not something we can judge;
 *  - it ignores unknown tokens rather than counting them as hard, since "not in a 15,000-lemma
 *    list" covers both `anticonstitutionnellement` and `Kumamoto`;
 *  - grammar, sentence length and idiom are invisible to it. A text of easy words can still be
 *    a hard read.
 */
import type { DB } from './staging';

export const LEVEL_ORDER: Record<string, string[]> = {
  en: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  fr: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  zh: ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6', 'HSK7-9'],
};

/** Share of known tokens that must sit at or below the reported band. */
const COVERAGE_TARGET = 0.9;
/** Below this share of recognised tokens we decline to judge the text at all. */
const MIN_RECOGNISED = 0.5;
/**
 * Fewer running words than this, or fewer recognised ones, and there is nothing to measure.
 *
 * Twenty is not a round number picked for comfort: the reported band is the one where cumulative
 * coverage crosses 90%, so each token moves the statistic by 1/n. At n=8 one token is worth 12.5%
 * — coarser than the threshold it is being compared against, which means a single unusual word
 * decides the answer. Measured: "le Slovène Tadej Pogačar remporte le Tour de France pour la
 * cinquième fois" came out C2. At n=20 a token is worth 5% and the threshold means something.
 * One-line news blurbs therefore get no level at all, which is the honest result — you cannot
 * grade a thirteen-word sentence.
 */
const MIN_TOKENS = 20;

export interface LevelEstimate {
  level: string;
  /** Share of all tokens found in our levelled lexicon — the estimate's own confidence. */
  recognised: number;
  tokens: number;
}

interface Lexicon {
  rankOf: Map<string, number>;
  maxKeyLen: number;
}

function buildLexicon(db: DB, lang: 'zh' | 'en' | 'fr'): Lexicon {
  const rank = new Map(LEVEL_ORDER[lang]!.map((l, i) => [l, i]));
  const rankOf = new Map<string, number>();
  let maxKeyLen = 1;
  for (const row of db
    .prepare(`SELECT headword, level FROM words WHERE lang = ? AND level IS NOT NULL`)
    .all(lang) as { headword: string; level: string }[]) {
    const r = rank.get(row.level);
    if (r === undefined) continue;
    const key = lang === 'zh' ? row.headword : row.headword.toLowerCase();
    // A word listed at several levels counts at its EASIEST — that is when the learner met it.
    const prev = rankOf.get(key);
    if (prev === undefined || r < prev) rankOf.set(key, r);
    if (lang === 'zh' && key.length > maxKeyLen) maxKeyLen = Math.min(key.length, 6);
  }
  return { rankOf, maxKeyLen };
}

/**
 * Which of our levelled headwords actually occur in a text, in order of first appearance.
 *
 * This is what `daily:candidates` offers Claude to curate the day's words from: words the learner
 * would meet in today's reading, rather than the next N rows of a frequency list.
 */
export function wordMatcher(db: DB, lang: 'zh' | 'en' | 'fr'): (text: string) => string[] {
  const lex = buildLexicon(db, lang);
  return (text: string) => {
    const r = lang === 'zh' ? segmentZh(text, lex.rankOf, lex.maxKeyLen) : tokenizeLatin(text, lex.rankOf);
    return [...new Set(r.matched)];
  };
}

/**
 * Build an estimator for one language. The lexicon load is the expensive part, so callers keep
 * the returned function for the whole run rather than calling this per item.
 */
export function levelEstimator(db: DB, lang: 'zh' | 'en' | 'fr'): (text: string) => LevelEstimate | null {
  const order = LEVEL_ORDER[lang]!;
  const { rankOf: lexicon, maxKeyLen } = buildLexicon(db, lang);

  return (text: string): LevelEstimate | null => {
    const ranks = lang === 'zh' ? segmentZh(text, lexicon, maxKeyLen) : tokenizeLatin(text, lexicon);
    // Below this the 90% threshold moves a whole band on one unusual word, which is noise dressed
    // up as a measurement. Measured on real data: a one-line Wikipedia blurb — "le Slovène Tadej
    // Pogačar remporte le Tour de France pour la cinquième fois" — scored C2 off a handful of
    // recognised tokens. Both counts have to clear the floor, not just the total.
    if (ranks.total < MIN_TOKENS || ranks.known.length < MIN_TOKENS) return null;
    const recognised = ranks.known.length / ranks.total;
    if (recognised < MIN_RECOGNISED) return null;

    const counts = new Array(order.length).fill(0) as number[];
    for (const r of ranks.known) counts[r]!++;
    let cumulative = 0;
    for (let i = 0; i < order.length; i++) {
      cumulative += counts[i]!;
      if (cumulative / ranks.known.length >= COVERAGE_TARGET) {
        return { level: order[i]!, recognised, tokens: ranks.total };
      }
    }
    return { level: order.at(-1)!, recognised, tokens: ranks.total };
  };
}

/**
 * Greedy longest-match segmentation against our own headwords.
 *
 * v0.4 learned this the hard way: matching headwords as plain substrings linked 有名 out of
 * 我没有名字 and 大人 out of 加拿大人. Consuming the longest match and moving past it is what
 * stops a word being "found" across a boundary it does not cross.
 */
function segmentZh(
  text: string,
  lexicon: Map<string, number>,
  maxKeyLen: number,
): { known: number[]; total: number; matched: string[] } {
  const known: number[] = [];
  const matched: string[] = [];
  let total = 0;
  const chars = [...text];
  for (let i = 0; i < chars.length; ) {
    const ch = chars[i]!;
    if (!/\p{Script=Han}/u.test(ch)) {
      i++;
      continue;
    }
    let took = 0;
    for (let len = Math.min(maxKeyLen, chars.length - i); len >= 1; len--) {
      const candidate = chars.slice(i, i + len).join('');
      const r = lexicon.get(candidate);
      if (r !== undefined) {
        known.push(r);
        matched.push(candidate);
        took = len;
        break;
      }
    }
    total++;
    i += took || 1;
  }
  return { known, total, matched };
}

function tokenizeLatin(
  text: string,
  lexicon: Map<string, number>,
): { known: number[]; total: number; matched: string[] } {
  const known: number[] = [];
  const matched: string[] = [];
  let total = 0;
  for (const raw of text.toLowerCase().split(/[^\p{L}]+/u)) {
    if (raw.length < 2) continue; //  articles and initials carry no difficulty signal
    total++;
    const r = lexicon.get(raw);
    if (r !== undefined) {
      known.push(r);
      matched.push(raw);
    }
  }
  return { known, total, matched };
}
