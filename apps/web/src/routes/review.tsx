import { useCallback, useEffect, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CardSnapshot, GRADES, previewMinutes, snapshotKind, State, type Grade, type UserCardRow } from '@mls/shared/srs';
import { StrokeWriter } from '../components/stroke-writer';
import { useDb } from '../db/provider';
import {
  fetchQueue,
  queueSummary,
  rateCard,
  setNewPerDay,
  streak,
  todayStats,
  type LangQueueSummary,
  type TodayStats,
} from '../db/user-queries';
import { clockOffsetMs, localDateStr, srsNow } from '../srs/clock';

// 'all' is a real deck, not a placeholder: script graphemes that belong to no single language
// (Latin letters, IPA phones) are stored with lang='all', and leaving it out of this list
// would let a user add such a card that then never comes up for review.
const LANGS = ['zh', 'en', 'fr', 'all'] as const;
/** Cards whose next step lands within this window loop back into the running session. */
const RELEARN_WINDOW_MS = 10 * 60_000;

const GRADE_KEYS: Record<Grade, string> = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };

/** Zod-guarded: snapshots cross the import trust boundary. null degrades the UI gracefully. */
function parseSnapshot(card: UserCardRow): CardSnapshot | null {
  try {
    const r = CardSnapshot.safeParse(JSON.parse(card.snapshot));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function Review() {
  const { t } = useTranslation();
  const db = useDb();
  const [phase, setPhase] = useState<'overview' | 'session' | 'done'>('overview');
  const [summaries, setSummaries] = useState<LangQueueSummary[]>([]);
  const [stats, setStats] = useState<TodayStats>({ new_count: 0, review_count: 0, seconds: 0 });
  const [streakDays, setStreakDays] = useState(0);
  const [queue, setQueue] = useState<UserCardRow[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const ratingRef = useRef(false); // re-entrancy guard: a double-tap must not rate twice
  const shownAt = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const now = srsNow();
    setSummaries(await queueSummary(db, [...LANGS], now));
    setStats(await todayStats(db, localDateStr(now)));
    setStreakDays(await streak(db, now));
  }, [db]);

  useEffect(() => {
    if (db.status.state === 'ready') void refresh();
  }, [db, refresh]);

  const start = async (langs: string[]) => {
    const q = await fetchQueue(db, langs, srsNow());
    if (q.length === 0) return;
    setQueue(q);
    setShowAnswer(false);
    shownAt.current = Date.now();
    setPhase('session');
  };

  const onRate = async (grade: Grade) => {
    if (ratingRef.current) return;
    const current = queue[0];
    if (!current) return;
    ratingRef.current = true;
    setRatingBusy(true);
    try {
      const now = srsNow();
      const updated = await rateCard(db, current, grade, now, Date.now() - shownAt.current);
      const rest = queue.slice(1);
      if (new Date(updated.due).getTime() <= now.getTime() + RELEARN_WINDOW_MS) rest.push(updated);
      setShowAnswer(false);
      shownAt.current = Date.now();
      setQueue(rest);
      if (rest.length === 0) {
        setPhase('done'); // flip first — the stale overview must not flash while refresh runs
        void refresh();
      }
    } finally {
      ratingRef.current = false;
      setRatingBusy(false);
    }
  };

  const onExport = async () => {
    const bytes = await db.userExport();
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `mls-user-${localDateStr(srsNow())}.db`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = async (file: File) => {
    if (!window.confirm(t('review.importConfirm'))) return;
    try {
      await db.userImport(await file.arrayBuffer());
      setNotice(t('review.importOk'));
      await refresh();
    } catch (e) {
      setNotice(t('review.importError', { message: e instanceof Error ? e.message : String(e) }));
    }
  };

  const offset = clockOffsetMs();
  const offsetBadge =
    offset !== 0 ? (
      <p className="hint debug-clock">
        ⏱ {t('review.debugClock', { offset: `${offset > 0 ? '+' : ''}${(offset / 864e5).toFixed(1)}d` })}
      </p>
    ) : null;

  // ---------------------------------------------------------------- session
  if (phase === 'session' && queue.length > 0) {
    const card = queue[0]!;
    const snap = parseSnapshot(card);
    const isGrapheme = snap !== null && snapshotKind(snap) === 'grapheme';
    const preview = previewMinutes(card, srsNow());
    return (
      <main className="review">
        {offsetBadge}
        <p className="hint">{t('review.remaining', { n: queue.length })}</p>
        <div className="review-card">
          {card.state === State.New && <span className="badge new-badge">{t('review.newBadge')}</span>}
          <div className="review-hw">{snap?.headword ?? card.id}</div>
          {showAnswer && snap && (
            <div className="review-answer">
              {snap.reading && <div className="reading">{snap.reading}</div>}
              {snap.altForm && snap.altForm !== snap.headword && <div className="hw">{snap.altForm}</div>}
              <ol className="senses">
                {snap.senses.map((s, i) => (
                  <li key={i}>
                    {s.pos && <em>{s.pos} </em>}
                    {s.glossVi ?? s.glossEn}
                  </li>
                ))}
              </ol>
              {snap.level && <span className="badge">{snap.level}</span>}
              {/* Grapheme cards get the writer on the answer side: recall first, then practise
                  the strokes. Stroke data comes from the snapshot — never from content.db. */}
              {isGrapheme && snap.strokeJson && (
                <StrokeWriter glyph={snap.headword} strokeJson={snap.strokeJson} />
              )}
            </div>
          )}
        </div>
        {!showAnswer ? (
          <button className="show-answer" onClick={() => setShowAnswer(true)}>
            {t('review.showAnswer')}
          </button>
        ) : (
          <div className="rating-row">
            {GRADES.map((g) => (
              <button
                key={g}
                className={`rating rating-${GRADE_KEYS[g]}`}
                disabled={ratingBusy}
                onClick={() => void onRate(g)}
              >
                <span>{t(`review.${GRADE_KEYS[g]}`)}</span>
                <span className="iv">{fmtInterval(preview[g], t)}</span>
              </button>
            ))}
          </div>
        )}
        <p>
          {isGrapheme ? (
            <Link to={`/write/${encodeURIComponent(snap?.headword ?? '')}`}>{t('review.glyphDetail')}</Link>
          ) : (
            <Link to={`/word/${encodeURIComponent(card.id)}`}>{t('review.wordDetail')}</Link>
          )}
        </p>
      </main>
    );
  }

  // ------------------------------------------------------------------- done
  if (phase === 'done') {
    return (
      <main className="review">
        {offsetBadge}
        <h2>{t('review.doneTitle')}</h2>
        <p>{t('review.today', { new: stats.new_count, reviews: stats.review_count })}</p>
        {streakDays > 0 && <p>{t('review.streak', { n: streakDays })}</p>}
        <button className="more" onClick={() => setPhase('overview')}>
          {t('word.back')}
        </button>
      </main>
    );
  }

  // --------------------------------------------------------------- overview
  const totalDue = summaries.reduce((n, s) => n + s.dueCount, 0);
  const totalNew = summaries.reduce((n, s) => n + s.newAvailable, 0);
  const deckEmpty = summaries.every((s) => s.totalCards === 0);
  return (
    <main className="review">
      <h2>{t('review.title')}</h2>
      {offsetBadge}
      {notice && <p className="hint">{notice}</p>}
      {streakDays > 0 && <p>{t('review.streak', { n: streakDays })}</p>}
      <p className="hint">{t('review.today', { new: stats.new_count, reviews: stats.review_count })}</p>

      {deckEmpty ? (
        <p>
          {t('review.emptyDeck')} <Link to="/browse">{t('nav.browse')}</Link>
        </p>
      ) : (
        <>
          <div className="review-summary">
            {summaries
              .filter((s) => s.totalCards > 0)
              .map((s) => (
                <div className="card" key={s.lang}>
                  <h3>{t(`lang.${s.lang}`)}</h3>
                  <p>
                    {t('review.due')}: <strong>{s.dueCount}</strong> · {t('review.new')}:{' '}
                    <strong>{s.newAvailable}</strong>
                  </p>
                  <p className="hint">{t('review.cards', { n: s.totalCards })}</p>
                  <label className="hint">
                    {t('review.newBudget')}{' '}
                    <BudgetInput
                      key={s.lang}
                      value={s.budget}
                      onCommit={(n) => void setNewPerDay(db, s.lang, n).then(refresh)}
                    />
                  </label>
                  {(s.dueCount > 0 || s.newAvailable > 0) && (
                    <button className="more" onClick={() => void start([s.lang])}>
                      {t('review.start')}
                    </button>
                  )}
                </div>
              ))}
          </div>
          {totalDue + totalNew > 0 ? (
            <button className="start-all" onClick={() => void start([...LANGS])}>
              {t('review.startAll', { n: totalDue + totalNew })}
            </button>
          ) : (
            <p>{t('review.allDone')}</p>
          )}
        </>
      )}

      <div className="backup">
        <h3>{t('review.backupTitle')}</h3>
        <p className="hint">{t('review.backupHint')}</p>
        <button onClick={() => void onExport()}>{t('review.export')}</button>{' '}
        <button onClick={() => fileRef.current?.click()}>{t('review.import')}</button>
        <input
          ref={fileRef}
          type="file"
          accept=".db,application/octet-stream"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void onImportFile(f);
          }}
        />
      </div>
    </main>
  );
}

/**
 * Draft-local number field: keystrokes echo synchronously (a controlled input bound to
 * async-refreshed state would drop/garble digits), persisted only on blur/Enter.
 */
function BudgetInput({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(n)) {
      setDraft(String(value)); // revert instead of coercing '' to 0
      return;
    }
    const clamped = Math.max(0, Math.min(99, Math.round(n)));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <input
      type="number"
      min={0}
      max={99}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function fmtInterval(minutes: number, t: TFunction): string {
  if (minutes < 1) return t('review.iv.now');
  if (minutes < 60) return t('review.iv.min', { n: minutes });
  if (minutes < 1440) return t('review.iv.hour', { n: Math.round(minutes / 60) });
  if (minutes < 43200) return t('review.iv.day', { n: Math.round(minutes / 1440) });
  return t('review.iv.month', { n: (minutes / 43200).toFixed(1) });
}
