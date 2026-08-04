/**
 * Weekly backup reminder — PLAN risk #3's prescription rendered as UI.
 * Shows when the learner has cards and the last export is >7 days old (or never).
 * Snooze = 24 h, stored in settings so it survives reloads AND travels with backups.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useDb } from '../db/provider';
import { countCards, getSetting, setSetting } from '../db/user-queries';
import { srsNow } from '../srs/clock';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SNOOZE_MS = 24 * 60 * 60 * 1000;

/** Dispatched by the export flow so the nag re-evaluates instead of lingering. */
export const BACKUP_DONE_EVENT = 'mls:backup-done';

export function BackupNag() {
  const { t } = useTranslation();
  const db = useDb();
  const location = useLocation();
  const [due, setDue] = useState(false);
  /** An export was offered and never confirmed — a different, milder, and TRUE thing to say. */
  const [unconfirmed, setUnconfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const evaluate = async () => {
      const cards = await countCards(db);
      if (cards === 0) return setDue(false);
      const now = srsNow().getTime();
      const last = Date.parse((await getSetting(db, 'last_backup_at')) ?? '') || 0;
      const snoozed = Date.parse((await getSetting(db, 'backup_nag_snoozed_at')) ?? '') || 0;
      const pending = Date.parse((await getSetting(db, 'backup_export_pending_at')) ?? '') || 0;
      if (cancelled) return;
      // "You downloaded a backup 25 hours ago and never told me whether it saved" is a fact the
      // app HAS. Saying "it has been over 7 days since your last backup" instead was a second
      // dishonesty in place of the first one, and a daily alarm a learner would train past.
      const awaitingAnswer = pending > last && now - pending <= WEEK_MS;
      setUnconfirmed(awaitingAnswer);
      setDue(awaitingAnswer ? now - snoozed > SNOOZE_MS : now - last > WEEK_MS && now - snoozed > SNOOZE_MS);
    };
    void evaluate();
    // Re-read from user.db rather than blindly hiding: a failed settings write must not
    // silence the reminder, and this is the only signal the export path can send.
    const onDone = () => void evaluate();
    window.addEventListener(BACKUP_DONE_EVENT, onDone);
    return () => {
      cancelled = true;
      window.removeEventListener(BACKUP_DONE_EVENT, onDone);
    };
  }, [db]);

  if (!due) return null;
  const onReview = location.pathname === '/review';

  return (
    <div className="backup-nag" role="status">
      <span>{unconfirmed ? t('storage.nagUnconfirmed') : t('storage.nag')}</span>{' '}
      {unconfirmed ? (
        // One click, from wherever they are, to record a backup they already have. Without this
        // the only writer of last_backup_at was a prompt that died on the next route change.
        <button
          className="linklike confirm-backup"
          onClick={() => {
            setDue(false);
            void (async () => {
              await setSetting(db, 'last_backup_at', new Date(srsNow()).toISOString());
              await setSetting(db, 'backup_export_pending_at', '');
              window.dispatchEvent(new Event(BACKUP_DONE_EVENT));
            })();
          }}
        >
          {t('storage.nagConfirm')}
        </button>
      ) : (
        !onReview && <Link to="/review">{t('storage.nagGo')}</Link>
      )}{' '}
      <button
        className="linklike"
        onClick={() => {
          setDue(false);
          void setSetting(db, 'backup_nag_snoozed_at', new Date(srsNow()).toISOString());
        }}
      >
        {t('media.dismiss')}
      </button>
    </div>
  );
}
