/**
 * Wire-service screening — a licence rule, so it lives in the contract package.
 *
 * VOA's Terms of Use put material produced *exclusively* by the Voice of America in the public
 * domain. That word does the work: a story a VOA writer adapted from the Associated Press is not
 * exclusively VOA's, and bundling it would redistribute AP's copyrighted reporting under a claim
 * that does not cover it. "This source is public domain" is a statement about a source, never
 * about every paragraph it published — the same lesson v0.4 learned when a vetted CC BY-SA corpus
 * turned out to be 67% CC0, and v0.5 learned again when a vetted Wikibooks title turned out to be
 * an 1851 grammar.
 *
 * TWO SHAPES THAT MEAN OPPOSITE THINGS. Measured on VOA Learning English, where three of four
 * sampled articles mention an agency:
 *   "Lauran Neergaard reported on this story for the Associated Press."  → the piece is derived
 *   "Choi told the Associated Press that researchers must wait…"          → a quoted attribution
 * Only the first disqualifies. Rejecting every mention would throw away most of a legitimately
 * public-domain archive; rejecting none would ship AP copy.
 *
 * It is deliberately applied TWICE — once by the ingest module that stores a row, and again by
 * `pack verify` over the finished pack. The second pass is the one that matters: it catches a
 * future module that forgets the first.
 */
const AGENCY = String.raw`Associated\s+Press|Reuters|Agence\s+France[-\s]?Presse|\bAFP\b|美联社|法新社|路透社|路透`;

const BYLINE = new RegExp(
  String.raw`(?:reported (?:on )?(?:this story )?for|adapted (?:it|this story) from|report(?:ing)? by|编译自|综合报道)[^.。\n]{0,80}(?:${AGENCY})`,
  'i',
);
const BYLINE_TRAILING = new RegExp(String.raw`(?:${AGENCY})[^.。\n]{0,60}(?:通讯社|供稿|报道)`, 'i');

export interface WireVerdict {
  /** True when the article itself is agency-derived and therefore not ours to bundle. */
  derived: boolean;
  /** The literal text that decided it — so a rejection is auditable, not a silent drop. */
  evidence: string | null;
  /** A mention that is only a quoted attribution: recorded, not disqualifying. */
  mentions: boolean;
}

export function screenWire(text: string): WireVerdict {
  const byline = BYLINE.exec(text) ?? BYLINE_TRAILING.exec(text);
  return {
    derived: byline !== null,
    evidence: byline ? byline[0].trim().slice(0, 120) : null,
    mentions: new RegExp(AGENCY, 'i').test(text),
  };
}
