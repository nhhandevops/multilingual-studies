import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDb } from '../db/provider';
import { getWord, getWordAudio, haveStrokeData, listExamples, type ExampleRow, type WordAudioRow } from '../db/queries';
import { SpeakButton } from '../components/speak-button';
import { MediaHint } from '../components/media-pack';
import { getCard } from '../db/user-queries';
import { AddToDeck } from '../components/add-to-deck';

type Detail = Awaited<ReturnType<typeof getWord>>;

const isHan = (ch: string): boolean => /\p{Script=Han}/u.test(ch);

export function WordPage() {
  const { t } = useTranslation();
  const db = useDb();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | 'loading'>('loading');
  const [inDeck, setInDeck] = useState(false);
  const [drawable, setDrawable] = useState<Set<string>>(new Set());
  const [examples, setExamples] = useState<ExampleRow[]>([]);
  // undefined = lookup in flight, null = no recording exists. See SpeakButton.
  const [audio, setAudio] = useState<WordAudioRow | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setDetail('loading');
    setDrawable(new Set());
    setExamples([]);
    setAudio(undefined);
    if (id) {
      const rawId = id; // React Router v7 already percent-decodes params — never decode twice
      void getWord(db, rawId).then(async (d) => {
        if (cancelled) return;
        setDetail(d);
        if (!d) return;
        const chars = [...new Set([...d.word.headword].filter(isHan))];
        const inPack = await haveStrokeData(db, chars);
        if (!cancelled) setDrawable(inPack);
      });
      void getCard(db, rawId).then((c) => {
        if (!cancelled) setInDeck(c !== null);
      });
      void listExamples(db, rawId, 3).then((e) => {
        if (!cancelled) setExamples(e);
      });
      void getWordAudio(db, rawId).then((a) => {
        if (!cancelled) setAudio(a);
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
        {/* Each character with stroke data links to its own writing page — the discovery path into /write. */}
        <span className="hw">
          {drawable.size > 0
            ? [...word.headword].map((ch, i) =>
                drawable.has(ch) ? (
                  <Link key={i} to={`/write/${encodeURIComponent(ch)}`} title={t('write.openGlyph', { glyph: ch })}>
                    {ch}
                  </Link>
                ) : (
                  <span key={i}>{ch}</span>
                ),
              )
            : word.headword}
        </span>
        {word.reading && <span className="reading" style={{ fontSize: '1.3rem' }}>{word.reading}</span>}
        <SpeakButton db={db} audio={audio} text={word.headword} lang={word.lang} />
        <span className="badge">{t(`lang.${word.lang}`, word.lang)}</span>
        {word.level && <span className="badge">{word.level}</span>}
        <AddToDeck word={word} senses={senses} inDeck={inDeck} onChange={setInDeck} />
      </div>
      {/* zh/fr word audio lives in the opt-in media pack (v0.9) — nudge where the value shows */}
      {(word.lang === 'zh' || word.lang === 'fr') && <MediaHint />}
      <dl>
        {word.alt_form && word.alt_form !== word.headword && (
          <>
            <dt>{t('word.traditional')}</dt>
            <dd className="hw" style={{ fontSize: '1.3rem' }}>{word.alt_form}</dd>
          </>
        )}
        {/* The ATTESTED Sino-Vietnamese cognate (v0.8) — a real Vietnamese word whose own
            dictionary entry records descent from this word. Absent for ~60% of zh words, and
            that absence is data: no attested cognate exists, so nothing is composed or guessed. */}
        {word.sv_cognate && (
          <>
            <dt>{t('word.svCognate')}</dt>
            <dd className="sv-cognate">{word.sv_cognate}</dd>
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
      {examples.length > 0 && (
        <section className="examples">
          <h3>{t('word.examples')}</h3>
          <ul>
            {examples.map((ex) => (
              <li key={ex.id}>
                {/* Tatoeba's own sentence recordings are CC BY-NC-ND, so they can never be
                    bundled — TTS is the only pronunciation these sentences will ever have. */}
                <p className="ex-text">
                  {ex.text} <SpeakButton db={db} audio={null} text={ex.text} lang={word.lang} />
                </p>
                {ex.reading && <p className="ex-reading">{ex.reading}</p>}
                {ex.trans_en && <p className="ex-trans">{ex.trans_en}</p>}
                {/* CC BY 2.0 FR: the contributor credit travels with the sentence. */}
                <p className="ex-credit">{ex.attribution}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="hint">
        {t('word.source')}: <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> ({source.license})
      </p>
    </main>
  );
}
