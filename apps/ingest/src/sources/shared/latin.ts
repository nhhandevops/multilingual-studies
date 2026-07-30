/**
 * seed:latin-letters — hand-authored stroke skeletons for the Latin alphabet.
 *
 * WHY THIS IS AUTHORED, NOT INGESTED. docs/RESEARCH-SOURCES.md established that no open dataset
 * of pedagogical letter-formation stroke order exists (everything is proprietary), and proposed
 * deriving one from Relief SingleLine (SIL OFL). Two findings changed that plan:
 *  1. hanzi-writer does not *stroke* the paths in `strokes` — it animates by stroking a thick
 *     line CLIPPED to them, so each entry must be a closed OUTLINE. A single-line font gives
 *     centrelines, which would clip to nothing. An offsetting step is required either way.
 *  2. Once you are offsetting centrelines anyway, authoring the centrelines parametrically is
 *     both simpler and pedagogically better: stroke order and direction are the whole point of
 *     a tracing exercise, and they are exactly what a font does not encode.
 * So the skeletons below are original work, published under the pack's own CC BY-SA 4.0. No
 * third-party font is downloaded or derived from, which also keeps the OFL out of the pack.
 *
 * Coordinate space is makemeahanzi's, so the same renderer drives hanzi and letters:
 * x∈[0,1024], y∈[-124,900], y pointing UP.
 */
import { graphemeId } from '@mls/shared';
import { alreadyIngested, recordRun, registerSource, type DB } from '../../lib/staging';

const SOURCE_ID = 'mls-latin';
const PARSER_VERSION = 1;

// --- the writing grid --------------------------------------------------------------------
const BASE = 100; //     baseline
const XH = 480; //       x-height line
const ASC = 760; //       ascender / cap height
const DESC = -90; //      descender depth
const MID = 512; //       horizontal centre
const HALF = 190; //      half-width of a typical round letter
const PEN = 46; //        half the pen width used to build outlines

type Pt = [number, number];

const line = (a: Pt, b: Pt, steps = 8): Pt[] =>
  Array.from({ length: steps + 1 }, (_, i) => [
    a[0] + ((b[0] - a[0]) * i) / steps,
    a[1] + ((b[1] - a[1]) * i) / steps,
  ] as Pt);

/** Elliptical arc, angles in degrees, 0° = east, counter-clockwise. */
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, steps = 24): Pt[] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const t = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)] as Pt;
  });

const join = (...parts: Pt[][]): Pt[] => {
  const out: Pt[] = [];
  for (const p of parts) for (const pt of p) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last[0] - pt[0], last[1] - pt[1]) > 1) out.push(pt);
  }
  return out;
};

const dot = (x: number, y: number): Pt[] => arc(x, y, 1, 1, 0, 360, 6);

// --- centreline → closed outline ----------------------------------------------------------

/** Unit normals per vertex, averaged across adjacent segments so corners don't pinch. */
function normals(pts: Pt[]): Pt[] {
  const n: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)]!;
    const next = pts[Math.min(pts.length - 1, i + 1)]!;
    let dx = next[0] - prev[0];
    let dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    n.push([-dy, dx]);
  }
  return n;
}

const fmt = (n: number): string => (Math.round(n * 10) / 10).toString();

/**
 * Offset a centreline by ±PEN into a closed path, with rounded caps. A dot (a degenerate
 * one-point stroke) becomes a circle instead — offsetting it would produce nothing.
 */
function outline(pts: Pt[]): string {
  if (pts.length < 2) {
    const [x, y] = pts[0] ?? [MID, BASE];
    const c = arc(x, y, PEN, PEN, 0, 360, 16);
    return `M ${c.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join(' L ')} Z`;
  }
  const n = normals(pts);
  const left: Pt[] = pts.map((p, i) => [p[0] + n[i]![0] * PEN, p[1] + n[i]![1] * PEN]);
  const right: Pt[] = pts.map((p, i) => [p[0] - n[i]![0] * PEN, p[1] - n[i]![1] * PEN]);
  const capAt = (i: number, dir: 1 | -1): Pt[] => {
    const p = pts[i]!;
    const a = Math.atan2(n[i]![1], n[i]![0]) * (180 / Math.PI);
    return arc(p[0], p[1], PEN, PEN, a, a + dir * 180, 8);
  };
  const ring = [...left, ...capAt(pts.length - 1, -1), ...right.reverse(), ...capAt(0, -1)];
  return `M ${ring.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join(' L ')} Z`;
}

// --- glyph skeletons ----------------------------------------------------------------------
// Each entry is an ordered list of strokes, each a centreline, in teaching stroke order.

const L = MID - HALF;
const R = MID + HALF;

const ACUTE: Pt[] = line([MID - 70, ASC - 40], [MID + 40, ASC + 60], 4);
const GRAVE: Pt[] = line([MID - 40, ASC + 60], [MID + 70, ASC - 40], 4);
const CIRCUMFLEX: Pt[] = join(line([MID - 90, ASC - 20], [MID, ASC + 70], 4), line([MID, ASC + 70], [MID + 90, ASC - 20], 4));
const DIAERESIS_L: Pt[] = [[MID - 80, ASC + 20]];
const DIAERESIS_R: Pt[] = [[MID + 80, ASC + 20]];
const CEDILLA: Pt[] = join(line([MID, BASE], [MID, BASE - 60], 3), arc(MID - 40, BASE - 70, 45, 45, 0, -150, 10));

/** o/c/e-style bowl, starting at 2 o'clock and going anticlockwise like handwriting. */
const bowl = (top = XH, bottom = BASE): Pt[] => {
  const cy = (top + bottom) / 2;
  const ry = (top - bottom) / 2;
  return arc(MID, cy, HALF, ry, 60, 420, 30);
};

const LOWER: Record<string, Pt[][]> = {
  a: [bowl(), line([R, XH], [R, BASE])],
  b: [line([L, ASC], [L, BASE]), arc(MID, (XH + BASE) / 2, HALF, (XH - BASE) / 2, 180, -180, 28)],
  c: [arc(MID, (XH + BASE) / 2, HALF, (XH - BASE) / 2, 45, 315, 26)],
  d: [bowl(), line([R, ASC], [R, BASE])],
  e: [join(line([L, (XH + BASE) / 2], [R, (XH + BASE) / 2], 6), arc(MID, (XH + BASE) / 2, HALF, (XH - BASE) / 2, 0, 290, 24))],
  f: [join(arc(MID + 40, ASC - 60, 110, 110, 0, 150, 12), line([MID - 70, ASC - 60], [MID - 70, BASE], 10)), line([L - 20, XH], [R - 60, XH], 5)],
  g: [bowl(), join(line([R, XH], [R, DESC + 60], 8), arc(R - 110, DESC + 60, 110, 80, 0, -160, 12))],
  h: [line([L, ASC], [L, BASE]), join(arc(MID, XH - 110, HALF, 110, 180, 0, 14), line([R, XH - 110], [R, BASE], 5))],
  i: [line([MID, XH], [MID, BASE]), dot(MID, XH + 130)],
  j: [join(line([MID + 60, XH], [MID + 60, DESC + 70], 9), arc(MID - 40, DESC + 70, 100, 80, 0, -170, 12)), dot(MID + 60, XH + 130)],
  k: [line([L, ASC], [L, BASE]), line([R, XH], [L + 30, XH - 200], 6), line([L + 30, XH - 200], [R, BASE], 6)],
  l: [line([MID, ASC], [MID, BASE])],
  m: [line([L, XH], [L, BASE]), join(arc(L + 95, XH - 95, 95, 95, 180, 0, 12), line([L + 190, XH - 95], [L + 190, BASE], 4)), join(arc(L + 285, XH - 95, 95, 95, 180, 0, 12), line([R, XH - 95], [R, BASE], 4))],
  n: [line([L, XH], [L, BASE]), join(arc(MID, XH - 110, HALF, 110, 180, 0, 14), line([R, XH - 110], [R, BASE], 5))],
  o: [bowl()],
  p: [line([L, XH], [L, DESC]), arc(MID, (XH + BASE) / 2, HALF, (XH - BASE) / 2, 180, -180, 28)],
  q: [bowl(), line([R, XH], [R, DESC])],
  r: [line([L, XH], [L, BASE]), arc(MID + 10, XH - 110, HALF - 10, 110, 180, 40, 10)],
  s: [join(arc(MID + 20, XH - 90, 150, 90, 30, 200, 14), arc(MID - 20, BASE + 90, 150, 90, 200, 380, 16))],
  t: [line([MID - 40, ASC], [MID - 40, BASE + 60]), arc(MID + 40, BASE + 60, 80, 60, 180, 90, 8), line([L - 10, XH], [R - 60, XH], 5)],
  u: [join(line([L, XH], [L, BASE + 110], 5), arc(MID, BASE + 110, HALF, 110, 180, 360, 14)), line([R, XH], [R, BASE])],
  v: [join(line([L, XH], [MID, BASE], 7), line([MID, BASE], [R, XH], 7))],
  w: [join(line([L, XH], [L + 95, BASE], 5), line([L + 95, BASE], [MID, XH - 80], 5), line([MID, XH - 80], [R - 95, BASE], 5), line([R - 95, BASE], [R, XH], 5))],
  x: [line([L, XH], [R, BASE], 8), line([R, XH], [L, BASE], 8)],
  y: [join(line([L, XH], [MID + 20, BASE], 7)), join(line([R, XH], [MID - 90, DESC], 9))],
  z: [join(line([L, XH], [R, XH], 6), line([R, XH], [L, BASE], 8), line([L, BASE], [R, BASE], 6))],
};

const UPPER: Record<string, Pt[][]> = {
  A: [line([L, BASE], [MID, ASC], 8), line([MID, ASC], [R, BASE], 8), line([L + 55, BASE + 240], [R - 55, BASE + 240], 5)],
  B: [line([L, ASC], [L, BASE]), arc(MID - 20, ASC - 165, 175, 165, 90, -90, 16), arc(MID - 20, BASE + 165, 190, 165, 90, -90, 16)],
  C: [arc(MID, (ASC + BASE) / 2, HALF + 10, (ASC - BASE) / 2, 45, 315, 28)],
  D: [line([L, ASC], [L, BASE]), arc(L + 20, (ASC + BASE) / 2, HALF + 30, (ASC - BASE) / 2, 90, -90, 20)],
  E: [line([L, ASC], [L, BASE]), line([L, ASC], [R, ASC], 6), line([L, (ASC + BASE) / 2], [R - 40, (ASC + BASE) / 2], 5), line([L, BASE], [R, BASE], 6)],
  F: [line([L, ASC], [L, BASE]), line([L, ASC], [R, ASC], 6), line([L, (ASC + BASE) / 2], [R - 40, (ASC + BASE) / 2], 5)],
  G: [join(arc(MID, (ASC + BASE) / 2, HALF + 10, (ASC - BASE) / 2, 45, 340, 28), line([R, (ASC + BASE) / 2 - 60], [R, (ASC + BASE) / 2], 3), line([R, (ASC + BASE) / 2], [MID + 30, (ASC + BASE) / 2], 3))],
  H: [line([L, ASC], [L, BASE]), line([R, ASC], [R, BASE]), line([L, (ASC + BASE) / 2], [R, (ASC + BASE) / 2], 6)],
  I: [line([MID, ASC], [MID, BASE])],
  J: [join(line([R - 40, ASC], [R - 40, BASE + 110], 8), arc(R - 190, BASE + 110, 150, 110, 0, -180, 14))],
  K: [line([L, ASC], [L, BASE]), line([R, ASC], [L + 30, (ASC + BASE) / 2 - 20], 7), line([L + 30, (ASC + BASE) / 2 - 20], [R, BASE], 7)],
  L: [line([L, ASC], [L, BASE]), line([L, BASE], [R, BASE], 6)],
  M: [line([L, BASE], [L, ASC], 8), line([L, ASC], [MID, BASE + 210], 7), line([MID, BASE + 210], [R, ASC], 7), line([R, ASC], [R, BASE], 8)],
  N: [line([L, BASE], [L, ASC], 8), line([L, ASC], [R, BASE], 9), line([R, BASE], [R, ASC], 8)],
  O: [arc(MID, (ASC + BASE) / 2, HALF + 10, (ASC - BASE) / 2, 90, 450, 32)],
  P: [line([L, ASC], [L, BASE]), arc(MID - 20, ASC - 165, 175, 165, 90, -90, 16)],
  Q: [arc(MID, (ASC + BASE) / 2, HALF + 10, (ASC - BASE) / 2, 90, 450, 32), line([MID + 40, BASE + 130], [R + 20, BASE - 60], 5)],
  R: [line([L, ASC], [L, BASE]), arc(MID - 20, ASC - 165, 175, 165, 90, -90, 16), line([MID - 20, (ASC + BASE) / 2], [R, BASE], 7)],
  S: [join(arc(MID + 20, ASC - 165, 175, 165, 30, 200, 16), arc(MID - 20, BASE + 165, 175, 165, 200, 380, 18))],
  T: [line([L, ASC], [R, ASC], 6), line([MID, ASC], [MID, BASE], 8)],
  U: [join(line([L, ASC], [L, BASE + 160], 6), arc(MID, BASE + 160, HALF, 160, 180, 360, 16), line([R, BASE + 160], [R, ASC], 6))],
  V: [join(line([L, ASC], [MID, BASE], 9), line([MID, BASE], [R, ASC], 9))],
  W: [join(line([L, ASC], [L + 95, BASE], 6), line([L + 95, BASE], [MID, ASC - 180], 6), line([MID, ASC - 180], [R - 95, BASE], 6), line([R - 95, BASE], [R, ASC], 6))],
  X: [line([L, ASC], [R, BASE], 9), line([R, ASC], [L, BASE], 9)],
  Y: [line([L, ASC], [MID, (ASC + BASE) / 2], 6), line([R, ASC], [MID, (ASC + BASE) / 2], 6), line([MID, (ASC + BASE) / 2], [MID, BASE], 5)],
  Z: [line([L, ASC], [R, ASC], 6), line([R, ASC], [L, BASE], 9), line([L, BASE], [R, BASE], 6)],
};

/** Accented forms = base letter strokes, then the mark. Order matters: the mark comes last. */
const ACCENTED: Record<string, { base: string; marks: Pt[][]; lowerMark?: boolean }> = {
  'é': { base: 'e', marks: [ACUTE] },
  'è': { base: 'e', marks: [GRAVE] },
  'ê': { base: 'e', marks: [CIRCUMFLEX] },
  'ë': { base: 'e', marks: [DIAERESIS_L, DIAERESIS_R] },
  'à': { base: 'a', marks: [GRAVE] },
  'â': { base: 'a', marks: [CIRCUMFLEX] },
  'ù': { base: 'u', marks: [GRAVE] },
  'û': { base: 'u', marks: [CIRCUMFLEX] },
  'ô': { base: 'o', marks: [CIRCUMFLEX] },
  'î': { base: 'i', marks: [CIRCUMFLEX] },
  'ï': { base: 'i', marks: [DIAERESIS_L, DIAERESIS_R] },
  'ç': { base: 'c', marks: [CEDILLA], lowerMark: true },
};

/** i and î/ï lose their tittle: the accent replaces it. */
const dropTittle = (base: string, strokes: Pt[][]): Pt[][] =>
  base === 'i' || base === 'j' ? strokes.slice(0, -1) : strokes;

function allGlyphs(): { glyph: string; strokes: Pt[][]; kindOrd: number }[] {
  const out: { glyph: string; strokes: Pt[][]; kindOrd: number }[] = [];
  let ord = 0;
  for (const [glyph, strokes] of Object.entries(LOWER)) out.push({ glyph, strokes, kindOrd: ord++ });
  for (const [glyph, spec] of Object.entries(ACCENTED)) {
    const base = LOWER[spec.base];
    if (!base) continue;
    out.push({ glyph, strokes: [...dropTittle(spec.base, base), ...spec.marks], kindOrd: ord++ });
  }
  for (const [glyph, strokes] of Object.entries(UPPER)) out.push({ glyph, strokes, kindOrd: ord++ });
  return out;
}

export async function run(db: DB): Promise<void> {
  const glyphs = allGlyphs();
  const inputSha = `latin-v${PARSER_VERSION}-${glyphs.length}`;
  if (alreadyIngested(db, SOURCE_ID, inputSha)) {
    console.log('  ✓ latin-letters unchanged, skipping');
    return;
  }

  registerSource(db, {
    id: SOURCE_ID,
    name: 'Latin letter stroke skeletons (this project)',
    url: 'https://github.com/nhhandevops/multilingual-studies',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attributionText:
      'Latin letter stroke-order skeletons authored for multilingual-studies and released under CC BY-SA 4.0. No open dataset of pedagogical letter formation exists, so these were written by hand rather than derived from a font.',
    retrievedAt: new Date().toISOString().slice(0, 10),
    licenseMode: 'bundled',
  });

  const insert = db.prepare(`
    INSERT INTO graphemes (id, lang, glyph, kind, reading, ipa, stroke_json, diagram_ref, audio_id, ord, notes_md, source_id)
    VALUES (@id, 'all', @glyph, 'letter', NULL, NULL, @stroke_json, NULL, NULL, @ord, NULL, '${SOURCE_ID}')
    ON CONFLICT(id) DO UPDATE SET stroke_json = excluded.stroke_json, ord = excluded.ord`);

  let rows = 0;
  db.transaction(() => {
    for (const g of glyphs) {
      const strokes = g.strokes.map(outline);
      // medians ARE the authored centrelines — no reconstruction, so tracing follows the
      // same path the animation draws.
      const medians = g.strokes.map((s) => s.map(([x, y]) => [Math.round(x), Math.round(y)]));
      insert.run({
        id: graphemeId('all', SOURCE_ID, g.glyph),
        glyph: g.glyph,
        stroke_json: JSON.stringify({ strokes, medians }),
        ord: g.kindOrd,
      });
      rows++;
    }
  })();

  recordRun(db, SOURCE_ID, rows, inputSha);
  const strokeCounts = glyphs.map((g) => g.strokes.length);
  console.log(`  ✓ latin-letters: ${rows} glyphs, ${strokeCounts.reduce((a, b) => a + b, 0)} strokes total`);
}
