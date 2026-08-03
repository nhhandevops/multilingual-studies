import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loading } from '../components/loading';
import { useDb } from '../db/provider';
import { getGrapheme, haveStrokeData, wordsWithChar, type GraphemeDetail, type WordRow } from '../db/queries';
import { addGraphemeCard, getCard, removeCard } from '../db/user-queries';
import { StrokeWriter } from '../components/stroke-writer';
import { assetUrl } from '../lib/url';
import { srsNow } from '../srs/clock';

/** U+2FF0–U+2FFB: the ideographic description operators inside an IDS like '⿰女子'. */
const isIdsOperator = (ch: string): boolean => ch >= '⿰' && ch <= '⿻';

interface Etymology {
  type?: string;
  hint?: string;
  phonetic?: string;
  semantic?: string;
}

export function GlyphPage() {
  const { t } = useTranslation();
  const db = useDb();
  const navigate = useNavigate();
  const { glyph } = useParams<{ glyph: string }>();
  const [detail, setDetail] = useState<GraphemeDetail | null | 'loading'>('loading');
  const [words, setWords] = useState<WordRow[]>([]);
  const [drawable, setDrawable] = useState<Set<string>>(new Set());
  const [inDeck, setInDeck] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDetail('loading');
    setWords([]);
    setInDeck(false);
    if (!glyph) return;
    const raw = glyph; // React Router already percent-decodes params — never decode twice
    void getGrapheme(db, raw).then(async (d) => {
      if (cancelled) return;
      setDetail(d);
      if (!d) return;
      void getCard(db, d.grapheme.id).then((c) => {
        if (!cancelled) setInDeck(c !== null);
      });
      const parts = [...(d.info?.decomposition ?? '')].filter((c) => !isIdsOperator(c) && c !== raw);
      const [inPack, containing] = await Promise.all([
        haveStrokeData(db, parts),
        wordsWithChar(db, raw, 24),
      ]);
      if (cancelled) return;
      setDrawable(inPack);
      setWords(containing);
    });
    return () => {
      cancelled = true;
    };
  }, [glyph, db]);

  if (detail === 'loading') return <Loading />;
  if (!detail)
    return (
      <main>
        <p>{t('write.notFound', { glyph })}</p>
        <Link to="/write">{t('write.backToIndex')}</Link>
      </main>
    );

  const { grapheme, info, source, infoSource } = detail;
  // `ord` is the stroke count for hanzi but the teaching order for letters, so never show it
  // as a stroke count — count the strokes in the data itself.
  let strokeCount = 0;
  if (grapheme.stroke_json) {
    try {
      strokeCount = (JSON.parse(grapheme.stroke_json) as { strokes?: unknown[] }).strokes?.length ?? 0;
    } catch {
      strokeCount = 0;
    }
  }

  const toggleDeck = async () => {
    if (busy) return; //  re-entrancy guard, same as the word-card button
    setBusy(true);
    try {
      if (inDeck) {
        await removeCard(db, grapheme.id);
        setInDeck(false);
      } else {
        const packVersion = db.status.state === 'ready' ? db.status.packVersion : '';
        await addGraphemeCard(db, grapheme, info?.definition ?? null, packVersion, srsNow());
        setInDeck(true);
      }
    } finally {
      setBusy(false);
    }
  };

  let etymology: Etymology | null = null;
  if (info?.etymology) {
    try {
      etymology = JSON.parse(info.etymology) as Etymology;
    } catch {
      etymology = null; // upstream JSON is trusted but never load-bearing
    }
  }

  return (
    <main className="glyph-detail">
      <p>
        <button className="linklike" onClick={() => navigate(-1)}>
          {t('word.back')}
        </button>
      </p>

      <div className="glyph-head">
        <div>
          <span className="hw">{grapheme.glyph}</span>
          {grapheme.reading && <span className="reading">{grapheme.reading}</span>}
          <span className="badge">{t('write.strokeCount', { count: strokeCount })}</span>
          {info?.radical && (
            <span className="badge">
              {t('write.radical')}: {info.radical}
            </span>
          )}
          <button
            className={`deck-btn labeled${inDeck ? ' in-deck' : ''}`}
            disabled={busy}
            onClick={() => void toggleDeck()}
          >
            {inDeck ? `✓ ${t('deck.remove')}` : `＋ ${t('write.addCard')}`}
          </button>
        </div>
        {info?.definition && <p className="gloss-block">{info.definition}</p>}
      </div>

      {grapheme.stroke_json ? (
        <StrokeWriter glyph={grapheme.glyph} strokeJson={grapheme.stroke_json} />
      ) : (
        <p className="error">{t('write.noStrokes')}</p>
      )}

      {info?.decomposition && (
        <section>
          <h3>{t('write.decomposition')}</h3>
          <p className="decomposition">
            {[...info.decomposition].map((ch, i) =>
              isIdsOperator(ch) ? (
                <span className="ids-op" key={i}>
                  {ch}
                </span>
              ) : drawable.has(ch) ? (
                <Link key={i} to={`/write/${encodeURIComponent(ch)}`}>
                  {ch}
                </Link>
              ) : (
                <span key={i}>{ch}</span>
              ),
            )}
          </p>
        </section>
      )}

      {etymology?.hint && (
        <section>
          <h3>{t('write.etymology')}</h3>
          <p>
            {etymology.type && <em>{etymology.type} · </em>}
            {etymology.hint}
          </p>
        </section>
      )}

      {words.length > 0 && (
        <section>
          <h3>{t('write.inWords')}</h3>
          <ul className="words">
            {words.map((w) => (
              <li key={w.id}>
                <Link to={`/word/${encodeURIComponent(w.id)}`}>
                  <span className="hw">{w.headword}</span>
                  {w.reading && <span className="reading">{w.reading}</span>}
                  {w.level && <span className="badge">{w.level}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="hint">
        {t('word.source')}:{' '}
        <a href={source.url} target="_blank" rel="noreferrer">
          {source.name}
        </a>{' '}
        ({source.license_url ? <a href={assetUrl(source.license_url)}>{source.license}</a> : source.license})
        {infoSource && (
          <>
            {' · '}
            <a href={infoSource.url} target="_blank" rel="noreferrer">
              {infoSource.name}
            </a>{' '}
            ({infoSource.license})
          </>
        )}
      </p>
    </main>
  );
}
