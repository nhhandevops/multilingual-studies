import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useDb } from '../db/provider';
import { getWord } from '../db/queries';

type Detail = Awaited<ReturnType<typeof getWord>>;

export function WordPage() {
  const { t } = useTranslation();
  const db = useDb();
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    setDetail('loading');
    if (id) {
      void getWord(db, decodeURIComponent(id)).then((d) => {
        if (!cancelled) setDetail(d);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [id, db]);

  if (detail === 'loading') return <p className="status">…</p>;
  if (!detail) return (
    <main>
      <p>{t('word.notFound')}</p>
      <Link to="/">{t('word.back')}</Link>
    </main>
  );

  const { word, senses, source } = detail;
  return (
    <main className="word-detail">
      <p>
        <Link to={-1 as never}>{t('word.back')}</Link>
      </p>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="hw">{word.headword}</span>
        {word.reading && <span className="reading" style={{ fontSize: '1.3rem' }}>{word.reading}</span>}
        <span className="badge">{t(`lang.${word.lang}`, word.lang)}</span>
        {word.level && <span className="badge">{word.level}</span>}
      </div>
      <dl>
        {word.alt_form && word.alt_form !== word.headword && (
          <>
            <dt>{t('word.traditional')}</dt>
            <dd className="hw" style={{ fontSize: '1.3rem' }}>{word.alt_form}</dd>
          </>
        )}
        {word.freq_rank && (
          <>
            <dt>{t('word.freqRank')}</dt>
            <dd>#{word.freq_rank}</dd>
          </>
        )}
      </dl>
      <h3>{t('word.definitions')}</h3>
      <ol className="senses">
        {senses.flatMap((s) =>
          (s.gloss_en ?? '').split('; ').map((g, i) => (
            <li key={`${s.ord}-${i}`}>
              {s.pos && <em>{s.pos} </em>}
              {g}
            </li>
          )),
        )}
      </ol>
      <p className="hint">
        {t('word.source')}: <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> ({source.license})
      </p>
    </main>
  );
}
