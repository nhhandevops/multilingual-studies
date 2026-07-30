import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDb } from '../db/provider';
import { getWord } from '../db/queries';
import { getCard } from '../db/user-queries';
import { AddToDeck } from '../components/add-to-deck';

type Detail = Awaited<ReturnType<typeof getWord>>;

export function WordPage() {
  const { t } = useTranslation();
  const db = useDb();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | 'loading'>('loading');
  const [inDeck, setInDeck] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDetail('loading');
    if (id) {
      const rawId = id; // React Router v7 already percent-decodes params — never decode twice
      void getWord(db, rawId).then((d) => {
        if (!cancelled) setDetail(d);
      });
      void getCard(db, rawId).then((c) => {
        if (!cancelled) setInDeck(c !== null);
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
        <button className="linklike" onClick={() => navigate(-1)}>
          {t('word.back')}
        </button>
      </p>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="hw">{word.headword}</span>
        {word.reading && <span className="reading" style={{ fontSize: '1.3rem' }}>{word.reading}</span>}
        <span className="badge">{t(`lang.${word.lang}`, word.lang)}</span>
        {word.level && <span className="badge">{word.level}</span>}
        <AddToDeck word={word} senses={senses} inDeck={inDeck} onChange={setInDeck} />
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
