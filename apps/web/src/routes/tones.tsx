import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDb } from '../db/provider';
import { listPinyinSyllables, type SyllableRow } from '../db/queries';
import { playAudio } from '../audio/player';

const TONES = [1, 2, 3, 4] as const;

/** A drillable base is one whose tones we can actually contrast, e.g. mā/má/mǎ/mà. */
interface Base {
  base: string; //                    numbered form without the tone digit
  byTone: Map<number, SyllableRow>;
}

type Answer = { picked: number; correct: boolean };

export function ToneDrill() {
  const { t } = useTranslation();
  const db = useDb();
  const [rows, setRows] = useState<SyllableRow[] | null>(null);
  const [current, setCurrent] = useState<{ base: Base; tone: number } | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [score, setScore] = useState({ right: 0, asked: 0, streak: 0, best: 0 });
  // Kept in a ref so picking the next question never depends on a stale render.
  const basesRef = useRef<Base[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listPinyinSyllables(db).then((r) => {
      if (!cancelled) setRows(r);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const bases = useMemo(() => {
    if (!rows) return [];
    const map = new Map<string, Base>();
    for (const r of rows) {
      if (r.ord === null || r.ord < 1 || r.ord > 4 || !r.audio_id) continue;
      const base = r.reading.replace(/[1-5]$/, '');
      let entry = map.get(base);
      if (!entry) map.set(base, (entry = { base, byTone: new Map() }));
      entry.byTone.set(r.ord, r);
    }
    // Only bases carrying all four tones: with a partial set, "which tone?" has a giveaway.
    return [...map.values()].filter((b) => b.byTone.size === 4);
  }, [rows]);

  basesRef.current = bases;

  const next = useCallback(() => {
    const pool = basesRef.current;
    if (pool.length === 0) return;
    const base = pool[Math.floor(Math.random() * pool.length)]!;
    const tone = TONES[Math.floor(Math.random() * TONES.length)]!;
    setAnswer(null);
    setCurrent({ base, tone });
    const row = base.byTone.get(tone);
    if (row?.audio_id) void playAudio(db, row.audio_id);
  }, [db]);

  useEffect(() => {
    if (bases.length > 0 && !current) next();
  }, [bases, current, next]);

  const pick = (picked: number) => {
    if (!current || answer) return; //  one answer per question
    const correct = picked === current.tone;
    setAnswer({ picked, correct });
    setScore((s) => {
      const streak = correct ? s.streak + 1 : 0;
      return { right: s.right + (correct ? 1 : 0), asked: s.asked + 1, streak, best: Math.max(s.best, streak) };
    });
  };

  const replay = () => {
    const row = current?.base.byTone.get(current.tone);
    if (row?.audio_id) void playAudio(db, row.audio_id);
  };

  if (!rows) return <p className="status">…</p>;
  if (bases.length === 0) return <p className="status">{t('tones.noAudio')}</p>;

  return (
    <main className="tone-drill">
      <h2>{t('tones.title')}</h2>
      <p className="hint">{t('tones.intro', { n: bases.length })}</p>
      <p className="hint">
        {t('tones.score', { right: score.right, asked: score.asked })}
        {score.streak > 1 && ` · ${t('tones.streak', { n: score.streak })}`}
      </p>

      <div className="review-card">
        <div className="review-hw">{answer ? current?.base.byTone.get(current.tone)?.glyph : '?'}</div>
        <button className="show-answer" onClick={replay}>
          🔊 {t('tones.replay')}
        </button>
      </div>

      <div className="rating-row">
        {TONES.map((n) => {
          const state = !answer
            ? ''
            : n === current?.tone
              ? ' tone-right'
              : n === answer.picked
                ? ' tone-wrong'
                : '';
          return (
            <button key={n} className={`rating tone-btn${state}`} disabled={answer !== null} onClick={() => pick(n)}>
              <span>{t(`pinyin.tone${n}`)}</span>
              <span className="iv">{current?.base.byTone.get(n)?.glyph}</span>
            </button>
          );
        })}
      </div>

      {answer && (
        <>
          <p className={answer.correct ? 'tone-verdict right' : 'tone-verdict wrong'}>
            {answer.correct ? t('tones.right') : t('tones.wrong', { tone: current?.tone })}
          </p>
          {/* Hearing the contrast is the whole point — let them compare before moving on. */}
          <p className="hint">{t('tones.compare')}</p>
          <div className="chips">
            {TONES.map((n) => {
              const row = current?.base.byTone.get(n);
              return (
                <button
                  key={n}
                  onClick={() => row?.audio_id && void playAudio(db, row.audio_id)}
                  className={n === current?.tone ? 'active' : ''}
                >
                  {row?.glyph}
                </button>
              );
            })}
          </div>
          <button className="start-all" onClick={next}>
            {t('tones.next')}
          </button>
        </>
      )}
    </main>
  );
}
