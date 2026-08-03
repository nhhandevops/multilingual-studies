import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loading } from '../components/loading';
import { useDb } from '../db/provider';
import { listPinyinSyllables, type SyllableRow } from '../db/queries';
import { playAudio } from '../audio/player';

/**
 * Longest-match-first. y and w are not initials in strict phonology, but every learner-facing
 * pinyin chart treats them as one, so the table does too.
 */
const INITIALS = [
  'zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
  'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w',
] as const;

/** 5 = neutral tone: only 19 syllables, but leaving them out would hide part of the pack. */
const TONES = [1, 2, 3, 4, 5] as const;

/** 'zhuang1' → { initial: 'zh', final: 'uang' }; 'ang4' → { initial: '', final: 'ang' } */
function split(numbered: string): { initial: string; final: string } {
  const bare = numbered.replace(/[1-5]$/, '');
  for (const i of INITIALS) {
    if (bare.startsWith(i) && bare.length > i.length) return { initial: i, final: bare.slice(i.length) };
  }
  return { initial: '', final: bare };
}

export function PinyinChart() {
  const { t } = useTranslation();
  const db = useDb();
  const [rows, setRows] = useState<SyllableRow[] | null>(null);
  const [tone, setTone] = useState<number>(1);
  const [playing, setPlaying] = useState<string | null>(null);
  const [tooOld, setTooOld] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listPinyinSyllables(db)
      .then((r) => {
        if (cancelled) return;
        setRows(r);
        if (r.length === 0) setTooOld(true); //  pre-v0.3 pack: graphemes exists but is empty
      })
      .catch(() => {
        if (!cancelled) { setRows([]); setTooOld(true); }
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  // Pivot once per tone: finals (rows) × initials (columns), keeping only cells that exist.
  const chart = useMemo(() => {
    if (!rows) return null;
    const cells = new Map<string, SyllableRow>(); //   `${final}|${initial}`
    const finals: string[] = [];
    const seenFinal = new Set<string>();
    const usedInitials = new Set<string>();
    for (const r of rows) {
      if (r.ord !== tone) continue;
      const { initial, final } = split(r.reading);
      if (!seenFinal.has(final)) {
        seenFinal.add(final);
        finals.push(final);
      }
      usedInitials.add(initial);
      cells.set(`${final}|${initial}`, r);
    }
    finals.sort((a, b) => (a.length === b.length ? a.localeCompare(b) : a.length - b.length));
    const initials = ['', ...INITIALS.filter((i) => usedInitials.has(i))];
    return { cells, finals, initials };
  }, [rows, tone]);

  const play = async (r: SyllableRow) => {
    if (!r.audio_id) return;
    setPlaying(r.id);
    await playAudio(db, r.audio_id);
    window.setTimeout(() => setPlaying((p) => (p === r.id ? null : p)), 600);
  };

  if (!rows) return <Loading />;

  return (
    <main>
      <h2>{t('pinyin.title')}</h2>
      {tooOld && <p className="error">{t('db.packTooOld')}</p>}
      <p className="hint">{t('pinyin.intro', { n: rows.length })}</p>
      <div className="chips">
        {TONES.map((n) => (
          <button key={n} className={tone === n ? 'active' : ''} onClick={() => setTone(n)}>
            {t(`pinyin.tone${n}`)}
          </button>
        ))}
      </div>
      {chart && (
        <div className="chart-scroll">
          <table className="pinyin-chart">
            <thead>
              <tr>
                <th />
                {chart.initials.map((i) => (
                  <th key={i || '∅'}>{i || '∅'}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.finals.map((f) => (
                <tr key={f}>
                  <th>{f}</th>
                  {chart.initials.map((i) => {
                    const cell = chart.cells.get(`${f}|${i}`);
                    return (
                      <td key={i || '∅'}>
                        {cell ? (
                          <button
                            className={`syl${playing === cell.id ? ' playing' : ''}`}
                            onClick={() => void play(cell)}
                            title={cell.reading}
                          >
                            {cell.glyph}
                          </button>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
