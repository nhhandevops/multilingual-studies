/**
 * `/stats` — the dashboard and the forecast. Three sections, three kinds of number, each
 * labelled as what it is:
 *
 *   MEASURED   — words in the deck vs the pack's level tables; your seconds-per-card from your
 *                own review history (only once ≥50 reviews exist; before that a default is used
 *                and said to be a default).
 *   SIMULATED  — the review load, by running FSRS-6 itself (the same engine and weights that
 *                schedule the real reviews) day by day at the chosen new-cards/day. Not the
 *                "10× rule": the simulation independently lands at ≈9–10×, which is the honest
 *                version of the same fact.
 *   ANCHORS    — Cambridge guided-learning hours and FSI hour figures, quoted with their one
 *                giant caveat: they assume an English-speaking learner. For a Vietnamese speaker
 *                Mandarin's 2,200 h is an UPPER BOUND — tones are already native equipment and
 *                ~60% of Vietnamese vocabulary is Sino-Vietnamese (the 大学→đại học pairs this
 *                version puts on the cards) — so the anchor is shown as a ceiling, not a quote.
 *
 * The level-reach forecast ("HSK3 vocabulary ~Mar 2027") is arithmetic on measured inputs:
 * (words at those levels not yet in the deck) ÷ (new/day). It forecasts VOCABULARY COVERAGE,
 * not proficiency — the label says so, because a date that quietly claimed "you will be HSK3"
 * would be the flattering lie.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { simulateLoad } from '@mls/shared/srs';
import { useDb } from '../db/provider';
import { levelsOf, listLevels } from '../db/queries';
import { deckCards, measuredSecondsPerCard, newPerDay } from '../db/user-queries';
// srsNow, not new Date(): the debug clock moves the forecast's "today" too, so a test can pin it.
import { srsNow } from '../srs/clock';

const LANGS = ['zh', 'en', 'fr'] as const;
type Lang = (typeof LANGS)[number];

const LEVEL_ORDER: Record<Lang, string[]> = {
  zh: ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6', 'HSK7-9'],
  en: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  fr: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
};

/** Default seconds per rated card until the learner's own history can speak. */
const DEFAULT_SECONDS = 10;
/** Extra cost of meeting a card for the first time, on top of a review. */
const NEW_CARD_SECONDS = 20;

interface LangProgress {
  lang: Lang;
  levels: { level: string; total: number; inDeck: number; studied: number }[];
  other: number; //  deck cards with no level in the current pack (incl. vanished words)
}

export function Stats() {
  const { t, i18n } = useTranslation();
  const db = useDb();
  const [progress, setProgress] = useState<LangProgress[]>([]);
  const [rates, setRates] = useState<Record<Lang, number>>({ zh: 5, en: 5, fr: 5 });
  const [secondsPerCard, setSecondsPerCard] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const out: LangProgress[] = [];
      const budgets: Record<Lang, number> = { zh: 5, en: 5, fr: 5 };
      for (const lang of LANGS) {
        const [table, cards] = await Promise.all([listLevels(db, lang), deckCards(db, lang)]);
        const levelOf = await levelsOf(db, cards.map((c) => c.id));
        const totals = new Map(table.map((r) => [r.level, r.n]));
        const inDeck = new Map<string, number>();
        const studied = new Map<string, number>();
        let other = 0;
        for (const c of cards) {
          const lv = levelOf.get(c.id) ?? null;
          if (lv === null || !totals.has(lv)) {
            other++;
            continue;
          }
          inDeck.set(lv, (inDeck.get(lv) ?? 0) + 1);
          if (c.state !== 0) studied.set(lv, (studied.get(lv) ?? 0) + 1);
        }
        out.push({
          lang,
          other,
          levels: LEVEL_ORDER[lang]
            .filter((lv) => totals.has(lv))
            .map((lv) => ({
              level: lv,
              total: totals.get(lv)!,
              inDeck: inDeck.get(lv) ?? 0,
              studied: studied.get(lv) ?? 0,
            })),
        });
        budgets[lang] = await newPerDay(db, lang);
      }
      const secs = await measuredSecondsPerCard(db);
      if (cancelled) return;
      setProgress(out);
      setRates(budgets);
      setSecondsPerCard(secs);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  if (!loaded) return <p className="status">…</p>;

  return (
    <main className="stats">
      <h2>{t('stats.title')}</h2>

      <section className="stats-block">
        <h3>{t('stats.progressTitle')}</h3>
        <p className="hint">{t('stats.progressHint')}</p>
        {progress.map((p) => (
          <LangBars key={p.lang} p={p} />
        ))}
      </section>

      <Forecast progress={progress} rates={rates} setRates={setRates} secondsPerCard={secondsPerCard} lang={i18n.language} />

      <section className="stats-block anchors">
        <h3>{t('stats.anchorsTitle')}</h3>
        <p className="hint">{t('stats.anchorsHint')}</p>
        <ul className="anchor-list">
          <li>{t('stats.anchorCefr')}</li>
          <li>{t('stats.anchorFsiFr')}</li>
          <li>{t('stats.anchorFsiZh')}</li>
        </ul>
        <p className="hint">{t('stats.anchorsCredit')}</p>
      </section>
    </main>
  );
}

function LangBars({ p }: { p: LangProgress }) {
  const { t } = useTranslation();
  return (
    <div className="lang-progress">
      <h4>{t(`lang.${p.lang}`)}</h4>
      {p.levels.map((l) => (
        <div className="level-row" key={l.level}>
          <span className="level-name">{l.level}</span>
          <div className="level-bar" role="img" aria-label={`${l.level}: ${l.inDeck}/${l.total}`}>
            {/* studied (dark) inside in-deck (light) inside total (track) — three honest strata */}
            <div className="bar-indeck" style={{ width: `${Math.min(100, (100 * l.inDeck) / l.total)}%` }} />
            <div className="bar-studied" style={{ width: `${Math.min(100, (100 * l.studied) / l.total)}%` }} />
          </div>
          <span className="level-nums">
            {l.inDeck}/{l.total}
          </span>
        </div>
      ))}
      {p.other > 0 && <p className="hint">{t('stats.otherCards', { n: p.other })}</p>}
    </div>
  );
}

/** Memoised across slider moves — a 365-day FSRS run per distinct rate, ~350 ms, cached. */
const simCache = new Map<number, ReturnType<typeof simulateLoad>>();
const simFor = (n: number) => {
  if (!simCache.has(n)) simCache.set(n, simulateLoad({ newPerDay: n, days: 365 }));
  return simCache.get(n)!;
};

function Forecast({
  progress,
  rates,
  setRates,
  secondsPerCard,
  lang: uiLang,
}: {
  progress: LangProgress[];
  rates: Record<Lang, number>;
  setRates: (r: Record<Lang, number>) => void;
  secondsPerCard: number | null;
  lang: string;
}) {
  const { t } = useTranslation();
  // Sliders re-render fast; the simulation only runs for values not yet cached.
  const [pending, setPending] = useState(rates);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commit = (next: Record<Lang, number>) => {
    setPending(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRates(next), 150);
  };

  const secs = secondsPerCard ?? DEFAULT_SECONDS;
  const totalNew = LANGS.reduce((a, l) => a + rates[l], 0);
  const sims = useMemo(() => LANGS.map((l) => ({ lang: l, sim: simFor(rates[l]) })), [rates]);
  const steadyReviews = sims.reduce((a, s) => a + s.sim.steadyReviews, 0);
  const minutesPerDay = (steadyReviews * secs + totalNew * (secs + NEW_CARD_SECONDS)) / 60;

  return (
    <section className="stats-block forecast">
      <h3>{t('stats.forecastTitle')}</h3>
      <p className="hint">{t('stats.forecastHint')}</p>
      {LANGS.map((l) => (
        <label key={l} className="rate-row">
          <span>{t(`lang.${l}`)}</span>
          <input
            type="range"
            min={0}
            max={20}
            value={pending[l]}
            onChange={(e) => commit({ ...pending, [l]: Number(e.target.value) })}
          />
          <strong>{pending[l]}</strong> {t('stats.newPerDay')}
        </label>
      ))}

      <div className="forecast-out">
        <p>
          {t('stats.loadLine', {
            reviews: Math.round(steadyReviews),
            minutes: Math.round(minutesPerDay),
          })}{' '}
          <span className="hint">
            {secondsPerCard === null
              ? t('stats.secsDefault', { s: DEFAULT_SECONDS })
              : t('stats.secsMeasured', { s: secondsPerCard.toFixed(1) })}
          </span>
        </p>
        <ul className="reach-list">
          {progress.map((p) => (
            <ReachLines key={p.lang} p={p} rate={rates[p.lang]} uiLang={uiLang} />
          ))}
        </ul>
        <p className="hint">{t('stats.simNote')}</p>
      </div>
    </section>
  );
}

function ReachLines({ p, rate, uiLang }: { p: LangProgress; rate: number; uiLang: string }) {
  const { t } = useTranslation();
  if (rate === 0) return null;
  // cumulative words through each level, minus what is already in the deck
  const lines: { level: string; date: string; days: number }[] = [];
  let remaining = 0;
  for (const l of p.levels) {
    remaining += l.total - l.inDeck;
    if (remaining <= 0) continue;
    const days = Math.ceil(remaining / rate);
    if (days > 365 * 6) break; //  a date six years out is noise, not information
    const when = new Date(srsNow().getTime() + days * 86_400_000);
    lines.push({
      level: l.level,
      days,
      date: when.toLocaleDateString(uiLang === 'vi' ? 'vi-VN' : 'en-GB', { month: 'short', year: 'numeric' }),
    });
    if (lines.length >= 3) break; //  the next three milestones, not a wall of dates
  }
  if (lines.length === 0) return null;
  return (
    <li>
      <strong>{t(`lang.${p.lang}`)}</strong>:{' '}
      {lines.map((l, i) => (
        <span key={l.level}>
          {i > 0 && ' · '}
          {t('stats.reach', { level: l.level, date: l.date })}
        </span>
      ))}
    </li>
  );
}
