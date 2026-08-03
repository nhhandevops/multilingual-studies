import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useDb } from '../db/provider';
import { browseHanzi, browseLetters, hanziStrokeCounts, type GraphemeRow, type HanziListRow } from '../db/queries';
import { Loading } from '../components/loading';

const LEVELS = ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6', 'HSK7-9'] as const;
const PAGE = 60;

type Filter = { level?: string; strokes?: number };
type Script = 'hanzi' | 'latin';

export function WriteIndex() {
  const { t } = useTranslation();
  const db = useDb();
  const [script, setScript] = useState<Script>('hanzi');
  const [filter, setFilter] = useState<Filter>({ level: 'HSK1' });
  const [counts, setCounts] = useState<{ ord: number; n: number }[]>([]);
  // `null` = the query has not answered yet, `[]` = there genuinely are no characters. Conflating
  // the two is what made this screen announce "no characters for this selection" for as long as
  // the first query took — telling the learner the data is missing when it is merely on its way.
  const [rows, setRows] = useState<HanziListRow[] | null>(null);
  const [letters, setLetters] = useState<GraphemeRow[] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tooOld, setTooOld] = useState(false);
  const epoch = useRef(''); // identifies the filter the current list belongs to

  useEffect(() => {
    // An installed pack from before v0.3 has no grapheme tables — the worker falls back to it
    // when an update can't be fetched, so say so instead of rendering an empty grid.
    // A pack built before v0.3 still HAS the `graphemes` table (it dates to v0.1) — it is
    // simply empty. So the signal is emptiness, not a failed query.
    void hanziStrokeCounts(db).then(setCounts).catch(() => setTooOld(true));
    void browseLetters(db)
      .then((l) => {
        setLetters(l);
        if (l.length === 0) setTooOld(true);
      })
      .catch(() => {
        setLetters([]); //  resolve the sentinel, or the spinner never stops
        setTooOld(true);
      });
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    epoch.current = `${filter.level ?? ''}|${filter.strokes ?? ''}`;
    setRows(null); //  a new filter is loading again — do not judge it by the old list
    void browseHanzi(db, filter, 0, PAGE)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]); //  a failed query is an answer; leaving null spins forever
        setTooOld(true);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, db]);

  const more = async () => {
    if (loadingMore) return; // double-click must not duplicate a page
    setLoadingMore(true);
    const key = epoch.current;
    try {
      const next = await browseHanzi(db, filter, rows?.length ?? 0, PAGE);
      if (epoch.current !== key) return; // filter switched mid-flight — drop the result
      setRows((r) => [...(r ?? []), ...next]);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <main>
      <h2>{t('write.title')}</h2>
      {tooOld && <p className="error">{t('db.packTooOld')}</p>}
      <p className="hint screen-intro">{t('write.intro')}</p>
      <div className="chips script">
        <button className={script === 'hanzi' ? 'active' : ''} onClick={() => setScript('hanzi')}>
          {t('write.scriptHanzi')}
        </button>
        <button className={script === 'latin' ? 'active' : ''} onClick={() => setScript('latin')}>
          {t('write.scriptLatin', { n: letters?.length ?? 0 })}
        </button>
      </div>

      {script === 'latin' ? (
        letters === null ? (
          <Loading />
        ) : (
          <ul className="glyph-grid">
            {letters.map((l) => (
              <li key={l.id}>
                <Link to={`/write/${encodeURIComponent(l.glyph)}`}>
                  <span className="glyph latin">{l.glyph}</span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
      <div className="chips levels">
        {LEVELS.map((l) => (
          <button key={l} className={filter.level === l ? 'active' : ''} onClick={() => setFilter({ level: l })}>
            {l}
          </button>
        ))}
      </div>
      <div className="chips strokes">
        <span className="hint">{t('write.byStrokes')}</span>
        {counts.map((c) => (
          <button
            key={c.ord}
            className={filter.strokes === c.ord ? 'active' : ''}
            onClick={() => setFilter({ strokes: c.ord })}
            title={t('write.strokeCount', { count: c.ord })}
          >
            {c.ord}
          </button>
        ))}
      </div>
      <ul className="glyph-grid">
        {(rows ?? []).map((r) => (
          <li key={r.id}>
            <Link to={`/write/${encodeURIComponent(r.glyph)}`}>
              <span className="glyph">{r.glyph}</span>
              {r.reading && <span className="reading">{r.reading}</span>}
              <span className="hint">{t('write.strokeCount', { count: r.ord ?? 0 })}</span>
            </Link>
          </li>
        ))}
      </ul>
      {rows === null && <Loading />}
      {rows !== null && rows.length === 0 && <p className="status">{t('write.empty')}</p>}
      {rows !== null && rows.length >= PAGE && (
        <button className="more" disabled={loadingMore} onClick={() => void more()}>
          {t('browse.more')}
        </button>
      )}
        </>
      )}
    </main>
  );
}
