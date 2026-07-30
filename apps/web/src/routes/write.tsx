import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useDb } from '../db/provider';
import { browseHanzi, hanziStrokeCounts, type HanziListRow } from '../db/queries';

const LEVELS = ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6', 'HSK7-9'] as const;
const PAGE = 60;

type Filter = { level?: string; strokes?: number };

export function WriteIndex() {
  const { t } = useTranslation();
  const db = useDb();
  const [filter, setFilter] = useState<Filter>({ level: 'HSK1' });
  const [counts, setCounts] = useState<{ ord: number; n: number }[]>([]);
  const [rows, setRows] = useState<HanziListRow[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const epoch = useRef(''); // identifies the filter the current list belongs to

  useEffect(() => {
    void hanziStrokeCounts(db).then(setCounts);
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    epoch.current = `${filter.level ?? ''}|${filter.strokes ?? ''}`;
    void browseHanzi(db, filter, 0, PAGE).then((r) => {
      if (!cancelled) setRows(r);
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
      const next = await browseHanzi(db, filter, rows.length, PAGE);
      if (epoch.current !== key) return; // filter switched mid-flight — drop the result
      setRows((r) => [...r, ...next]);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <main>
      <h2>{t('write.title')}</h2>
      <p className="hint">{t('write.intro')}</p>
      <div className="chips">
        {LEVELS.map((l) => (
          <button key={l} className={filter.level === l ? 'active' : ''} onClick={() => setFilter({ level: l })}>
            {l}
          </button>
        ))}
      </div>
      <div className="chips">
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
        {rows.map((r) => (
          <li key={r.id}>
            <Link to={`/write/${encodeURIComponent(r.glyph)}`}>
              <span className="glyph">{r.glyph}</span>
              {r.reading && <span className="reading">{r.reading}</span>}
              <span className="hint">{t('write.strokeCount', { count: r.ord ?? 0 })}</span>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="status">{t('write.empty')}</p>}
      {rows.length >= PAGE && (
        <button className="more" disabled={loadingMore} onClick={() => void more()}>
          {t('browse.more')}
        </button>
      )}
    </main>
  );
}
