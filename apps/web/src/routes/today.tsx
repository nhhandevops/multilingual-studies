/**
 * `/today` — the day's reading, words and tip; `/today/:id` — read one item.
 *
 * The screen is built around one fact about a local-first app: THE PACK IS OLDER THAN TODAY. It is
 * downloaded once and read offline until the learner updates it, so "today's news" can only ever
 * mean "the newest day this pack holds". Rather than hide that, the screen states the date it is
 * showing. Everything else follows from the same principle — each section degrades to something
 * useful instead of disappearing:
 *
 *   news      → the newest pulled day, labelled with its date
 *   reading   → the graded archive, which is dateless and always works
 *   words     → the day's plan; `daily:all` writes a provisional one, curation improves it
 *   tip       → the tip written for that date, else a deterministic pick from the evergreen set
 *
 * So a learner who never runs /daily-pull still opens the app to a usable day, and one who runs it
 * every morning opens it to a curated one.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Markdown } from '../components/markdown';
import { SpeakButton } from '../components/speak-button';
import { AddToDeck } from '../components/add-to-deck';
import { useDb } from '../db/provider';
import {
  dailyLangs,
  dailyPlanWords,
  getDailyItem,
  gradedLevels,
  latestPullDate,
  listDailyNews,
  listGradedReading,
  tipLinks,
  tipOfDay,
  type DailyItemRow,
  type PlannedWord,
  type TipRow,
} from '../db/queries';
import { deckIds } from '../db/user-queries';
import { localDateStr, srsNow } from '../srs/clock';

export function Today() {
  const { t } = useTranslation();
  const db = useDb();
  const [langs, setLangs] = useState<{ lang: string; n: number }[]>([]);
  const [lang, setLang] = useState<string | null>(null);
  // `undefined` = still loading, `null` = genuinely nothing. Conflating the two makes the screen
  // announce "this pack has no news" for the fraction of a second before the query returns —
  // the same three-state distinction v0.4 had to make for audio lookups.
  const [pullDate, setPullDate] = useState<string | null | undefined>(undefined);
  const [news, setNews] = useState<DailyItemRow[]>([]);
  const [levels, setLevels] = useState<{ level: string; n: number }[]>([]);
  const [level, setLevel] = useState<string | undefined>();
  const [reading, setReading] = useState<DailyItemRow[]>([]);
  const [words, setWords] = useState<PlannedWord[]>([]);
  const [deck, setDeck] = useState<Set<string>>(new Set());
  const [tip, setTip] = useState<TipRow | null>(null);
  const [tooOld, setTooOld] = useState(false);

  // The debug clock moves "today" too, so a test can drive the tip rotation without waiting a day.
  const today = localDateStr(srsNow());

  useEffect(() => {
    void dailyLangs(db)
      .then((l) => {
        setLangs(l);
        if (l.length === 0) setTooOld(true);
        else setLang((cur) => cur ?? l[0]!.lang);
      })
      .catch(() => setTooOld(true));
  }, [db]);

  useEffect(() => {
    if (!lang) return;
    let cancelled = false;
    setLevel(undefined);
    setPullDate(undefined);
    void (async () => {
      const date = await latestPullDate(db, lang);
      const items = date ? await listDailyNews(db, lang, date) : [];
      const lv = await gradedLevels(db, lang);
      const plan = await dailyPlanWords(db, lang, null);
      const dayTip = await tipOfDay(db, lang, today);
      if (cancelled) return;
      setPullDate(date);
      setNews(items);
      setLevels(lv);
      setWords(plan);
      setTip(dayTip);
      setDeck(await deckIds(db, plan.map((w) => w.id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [lang, db, today]);

  useEffect(() => {
    if (!lang) return;
    let cancelled = false;
    void listGradedReading(db, lang, level).then((r) => {
      if (!cancelled) setReading(r);
    });
    return () => {
      cancelled = true;
    };
  }, [lang, level, db]);

  if (tooOld)
    return (
      <main>
        <p className="status">{t('db.packTooOld')}</p>
      </main>
    );

  return (
    <main className="today">
      <h2>{t('today.title')}</h2>
      <div className="chips langs">
        {langs.map((l) => (
          <button key={l.lang} className={l.lang === lang ? 'active' : ''} onClick={() => setLang(l.lang)}>
            {t(`lang.${l.lang}`, l.lang)} <span className="muted">{l.n}</span>
          </button>
        ))}
      </div>

      <section className="today-block">
        <h3>{t('today.news')}</h3>
        {pullDate === undefined ? (
          <p className="hint">…</p>
        ) : pullDate ? (
          <p className="hint">
            {pullDate === today ? t('today.freshToday') : t('today.freshFrom', { date: pullDate })}
          </p>
        ) : (
          <p className="hint">{t('today.noNews')}</p>
        )}
        <ul className="daily-list">
          {news.map((n) => (
            <DailyRow key={n.id} item={n} />
          ))}
        </ul>
      </section>

      {reading.length > 0 && (
        <section className="today-block">
          <h3>{t('today.reading')}</h3>
          <p className="hint">{t('today.readingHint')}</p>
          {levels.length > 0 && (
            <div className="chips levels">
              <button className={level === undefined ? 'active' : ''} onClick={() => setLevel(undefined)}>
                {t('grammar.allLevels')}
              </button>
              {levels.map((l) => (
                <button key={l.level} className={l.level === level ? 'active' : ''} onClick={() => setLevel(l.level)}>
                  {l.level} <span className="muted">{l.n}</span>
                </button>
              ))}
            </div>
          )}
          <ul className="daily-list">
            {reading.map((r) => (
              <DailyRow key={r.id} item={r} />
            ))}
          </ul>
        </section>
      )}

      <section className="today-block">
        <h3>{t('today.words')}</h3>
        {words.length === 0 ? (
          <p className="hint">{t('today.noWords')}</p>
        ) : (
          <ul className="words">
            {words.map((w) => (
              <li key={w.id}>
                <Link to={`/word/${encodeURIComponent(w.id)}`}>
                  <span className="hw">{w.headword}</span>
                  {w.reading && <span className="reading">{w.reading}</span>}
                  {/* A reason means a human chose this word; its absence means the pull picked it
                      from the day's articles. Saying which is cheap and keeps the screen honest. */}
                  <span className="gloss">{w.reason ?? t('today.autoPicked')}</span>
                  {w.level && <span className="badge">{w.level}</span>}
                </Link>
                <AddToDeck
                  compact
                  word={w}
                  inDeck={deck.has(w.id)}
                  onChange={(v) =>
                    setDeck((prev) => {
                      const next = new Set(prev);
                      if (v) next.add(w.id);
                      else next.delete(w.id);
                      return next;
                    })
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {tip && (
        <section className="today-block tip">
          <h3>{t('today.tip')}</h3>
          <h4>{tip.title}</h4>
          <Markdown body={tip.body_md} />
          {tipLinks(tip).length > 0 && (
            <p className="hint">
              {tipLinks(tip).map((l, i) => (
                <span key={l.url}>
                  {i > 0 && ' · '}
                  {l.url.startsWith('/') ? <Link to={l.url}>{l.label}</Link> : (
                    <a href={l.url} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  )}
                </span>
              ))}
            </p>
          )}
        </section>
      )}
    </main>
  );
}

function DailyRow({ item }: { item: DailyItemRow }) {
  return (
    <li>
      <Link to={`/today/${encodeURIComponent(item.id)}`}>
        <span className="daily-title">{item.title}</span>
        {item.level_est && <span className="badge">{item.level_est}</span>}
        <span className="muted">{item.source_name}</span>
      </Link>
      {item.curated_note && <p className="curated-note">{item.curated_note}</p>}
    </li>
  );
}

export function DailyItemPage() {
  const { t } = useTranslation();
  const db = useDb();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<DailyItemRow | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    setRow('loading');
    if (!id) return;
    void getDailyItem(db, id).then((r) => {
      if (!cancelled) setRow(r);
    });
    return () => {
      cancelled = true;
    };
  }, [id, db]);

  if (row === 'loading') return <p className="status">…</p>;
  if (!row)
    return (
      <main>
        <p>{t('today.notFound')}</p>
        <Link to="/today">{t('today.back')}</Link>
      </main>
    );

  return (
    <main className="daily-detail">
      <p>
        <button className="linklike" onClick={() => navigate(-1)}>
          {t('today.back')}
        </button>
      </p>
      <h2>{row.title}</h2>
      <p>
        {row.level_est && <span className="badge">{row.level_est}</span>}
        <span className="badge">{t(`lang.${row.lang}`, row.lang)}</span>
        {row.published_at && <span className="muted">{row.published_at}</span>}
        <SpeakButton db={db} audio={null} text={row.title} lang={row.lang} />
      </p>

      {row.curated_note && <p className="curated-note">{row.curated_note}</p>}

      {row.license_mode === 'link-only' ? (
        // Same rule as the grammar reader: never print body text for a link-only source, even if
        // a future module wrongly stored some.
        <p className="hint">{t('grammar.linkOnlyBody')}</p>
      ) : row.body_text ? (
        <Markdown body={row.body_text} />
      ) : (
        <p className="hint">{t('today.noBody')}</p>
      )}

      <p className="hint">
        {row.url && (
          <a href={row.url} target="_blank" rel="noreferrer">
            {t('today.readOriginal')}
          </a>
        )}
        {/* Audio is linked, never fetched: one VOA clip is ~3.4 MB, and the app makes no
            off-origin request of its own. Clicking this leaves the app, deliberately. */}
        {row.audio_url && (
          <>
            {row.url && ' · '}
            <a href={row.audio_url} target="_blank" rel="noreferrer">
              {t('today.listenAtSource')}
            </a>
          </>
        )}
      </p>
      <p className="hint attribution">{row.attribution}</p>
      <p className="hint">
        {t('word.source')}:{' '}
        <a href={row.source_url} target="_blank" rel="noreferrer">
          {row.source_name}
        </a>{' '}
        ({row.license})
      </p>
    </main>
  );
}
