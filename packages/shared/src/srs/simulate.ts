/**
 * Review-load simulation — the honest version of the "10× rule".
 *
 * The research anchor says steady-state reviews run ≈8–12× daily new intake, but that is a rule
 * of thumb about Anki's SM-2 era. This app schedules with FSRS-6, so the simulator RUNS FSRS-6:
 * the same `rate()` wrapper, the same default weights and 0.9 retention target, day by day, card
 * by card. What it reports is what the scheduler it is reporting on would actually do.
 *
 * Deterministic on purpose: grades are drawn from a seeded LCG, so the same inputs produce the
 * same curve on every machine and every reload. A forecast that changes when you refresh is a
 * mood, not a forecast. (This also makes the acceptance test possible.)
 *
 * The grade mix models a learner at FSRS's own target retention: Again 8% / Hard 12% /
 * Good 70% / Easy 10% ≈ 92% of reviews pass, slightly above the 0.9 the engine optimises for —
 * real users near target retention rate this way. Sub-day learning-step reviews are counted as
 * reviews (they cost real time in a session) but capped per day so a pathological loop cannot
 * hang the UI thread.
 */
import { Rating, type Grade } from 'ts-fsrs';
import { newSrsFields, rate, type SrsFields } from './fsrs';

export interface SimDay {
  day: number; //      1-based
  reviews: number; //  ratings of previously-seen cards (incl. same-day learning steps)
  news: number; //     first ratings of new cards
}

export interface SimResult {
  days: SimDay[];
  /** Mean reviews/day over the window's last 30 days — the steady-ish figure to display. */
  steadyReviews: number;
  /** Mean over days 1–30, while the backlog is still ramping. */
  earlyReviews: number;
  peakReviews: number;
  totalCards: number;
}

/** Deterministic LCG (Numerical Recipes constants); good enough to sample four grades. */
const lcg = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
};

const gradeFor = (r: number): Grade => {
  if (r < 0.08) return Rating.Again;
  if (r < 0.2) return Rating.Hard;
  if (r < 0.9) return Rating.Good;
  return Rating.Easy;
};

/** Hard bound on same-day step reviews per card per day; FSRS never needs more in practice. */
const MAX_SAME_DAY_STEPS = 4;

export function simulateLoad(opts: { newPerDay: number; days: number; seed?: number }): SimResult {
  const { newPerDay, days } = opts;
  const rand = lcg(opts.seed ?? 42);
  const dayMs = 86_400_000;
  const t0 = Date.UTC(2026, 0, 1); //  fixed epoch — the simulation is relative, dates are not real
  const cards: SrsFields[] = [];
  const out: SimDay[] = [];

  for (let day = 1; day <= days; day++) {
    const start = t0 + (day - 1) * dayMs;
    const end = start + dayMs;
    let reviews = 0;
    let news = 0;

    // today's new cards enter at the start of the day
    for (let i = 0; i < newPerDay; i++) cards.push(newSrsFields(new Date(start)));

    // review everything due today; a learning step may come due again the same day
    for (let i = 0; i < cards.length; i++) {
      let steps = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const due = Date.parse(cards[i]!.due);
        if (due >= end || steps >= MAX_SAME_DAY_STEPS) break;
        const wasNew = cards[i]!.state === 0;
        // review happens when the card comes due, never before midnight it was created
        const at = new Date(Math.max(due, start));
        cards[i] = rate(cards[i]!, gradeFor(rand()), at).next;
        if (wasNew) news++;
        else reviews++;
        steps++;
      }
    }
    out.push({ day, reviews, news });
  }

  const mean = (xs: SimDay[]) => (xs.length ? xs.reduce((a, d) => a + d.reviews, 0) / xs.length : 0);
  return {
    days: out,
    steadyReviews: mean(out.slice(-30)),
    earlyReviews: mean(out.slice(0, 30)),
    peakReviews: out.reduce((a, d) => Math.max(a, d.reviews), 0),
    totalCards: cards.length,
  };
}
