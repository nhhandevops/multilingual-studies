/**
 * hanzi-writer (MIT) wrapper. Stroke data comes from our own pack — the writer never fetches:
 * `charDataLoader` just hands back the JSON we already have, so this works fully offline.
 *
 * The writer mutates a DOM node imperatively, so it is created in an effect keyed on the data
 * and torn down by cancelling any quiz and emptying the node. Colours are resolved from
 * prefers-color-scheme rather than CSS vars because hanzi-writer writes SVG attributes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HanziWriter from 'hanzi-writer';
import type { CharacterJson } from 'hanzi-writer';

const SIZE = 260;

const PALETTE = {
  light: { strokeColor: '#1a1a1a', outlineColor: '#dcdcda', highlightColor: '#0b6e4f', drawingColor: '#c0392b' },
  dark: { strokeColor: '#ececec', outlineColor: '#3a3a3a', highlightColor: '#4cc38a', drawingColor: '#ff7a68' },
} as const;

function useScheme(): 'light' | 'dark' {
  const [scheme, setScheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setScheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return scheme;
}

export interface StrokeWriterProps {
  glyph: string;
  /** `{strokes, medians}` exactly as stored in graphemes.stroke_json. */
  strokeJson: string;
  /** Fired once per completed trace with the number of mistakes made. */
  onTraced?: (totalMistakes: number) => void;
}

type Phase = { kind: 'idle' } | { kind: 'tracing'; done: number; mistakes: number } | { kind: 'traced'; mistakes: number };

export function StrokeWriter({ glyph, strokeJson, onTraced }: StrokeWriterProps) {
  const { t } = useTranslation();
  const scheme = useScheme();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [failed, setFailed] = useState(false);
  // onTraced may be a fresh closure each render; keep the writer's callback stable.
  const onTracedRef = useRef(onTraced);
  onTracedRef.current = onTraced;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let data: CharacterJson;
    try {
      data = JSON.parse(strokeJson) as CharacterJson;
    } catch {
      setFailed(true);
      return;
    }
    setFailed(false);
    setStrokeCount(data.strokes.length);
    setPhase({ kind: 'idle' });

    const writer = HanziWriter.create(host, glyph, {
      width: SIZE,
      height: SIZE,
      padding: 12,
      showCharacter: false, //          start from the outline: the point is to watch it drawn
      showOutline: true,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 320,
      ...PALETTE[scheme],
      charDataLoader: () => data, //   never hits the network
    });
    writerRef.current = writer;

    return () => {
      writer.cancelQuiz();
      writerRef.current = null;
      host.replaceChildren(); //       hanzi-writer has no destroy(); drop its SVG outright
    };
  }, [glyph, strokeJson, scheme]);

  const animate = useCallback(() => {
    const writer = writerRef.current;
    if (!writer) return;
    writer.cancelQuiz();
    setPhase({ kind: 'idle' });
    void writer.animateCharacter();
  }, []);

  const trace = useCallback(() => {
    const writer = writerRef.current;
    if (!writer) return;
    setPhase({ kind: 'tracing', done: 0, mistakes: 0 });
    void writer.hideCharacter();
    void writer.quiz({
      showHintAfterMisses: 3,
      onCorrectStroke: ({ strokesRemaining, totalMistakes }) =>
        setPhase({ kind: 'tracing', done: strokeCount - strokesRemaining, mistakes: totalMistakes }),
      onMistake: ({ totalMistakes, strokesRemaining }) =>
        setPhase({ kind: 'tracing', done: strokeCount - strokesRemaining, mistakes: totalMistakes }),
      onComplete: ({ totalMistakes }) => {
        setPhase({ kind: 'traced', mistakes: totalMistakes });
        onTracedRef.current?.(totalMistakes);
      },
    });
  }, [strokeCount]);

  const reveal = useCallback(() => {
    const writer = writerRef.current;
    if (!writer) return;
    writer.cancelQuiz();
    setPhase({ kind: 'idle' });
    void writer.showCharacter();
  }, []);

  if (failed) return <p className="error">{t('write.noStrokes')}</p>;

  return (
    <div className="stroke-writer">
      <div className="stroke-stage" ref={hostRef} style={{ width: SIZE, height: SIZE }} />
      <div className="stroke-controls">
        <button className="sw-animate" onClick={animate}>{t('write.animate')}</button>
        <button className="sw-trace" onClick={trace}>{t('write.trace')}</button>
        <button className="sw-reveal" onClick={reveal}>{t('write.reveal')}</button>
      </div>
      <p className="stroke-status hint">
        {phase.kind === 'tracing' &&
          t('write.tracing', { done: phase.done, total: strokeCount, mistakes: phase.mistakes })}
        {phase.kind === 'traced' &&
          (phase.mistakes === 0 ? t('write.tracedPerfect') : t('write.traced', { mistakes: phase.mistakes }))}
        {phase.kind === 'idle' && t('write.strokeCount', { count: strokeCount })}
      </p>
    </div>
  );
}
