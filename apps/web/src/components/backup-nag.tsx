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

export function BackupNag() {
  const { t } = useTranslation();
  const db = useDb();
  const location = useLocation();
  const [due, setDue] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cards = await countCards(db);
      if (cards === 0) return;
      const now = srsNow().getTime();
      const last = Date.parse((await getSetting(db, 'last_backup_at')) ?? '') || 0;
      const snoozed = Date.parse((await getSetting(db, 'backup_nag_snoozed_at')) ?? '') || 0;
      if (!cancelled) setDue(now - last > WEEK_MS && now - snoozed > SNOOZE_MS);
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  if (!due) return null;
  const onReview = location.pathname === '/review';

  return (
    <div className="backup-nag" role="status">
      <span>{t('storage.nag')}</span>{' '}
      {!onReview && <Link to="/review">{t('storage.nagGo')}</Link>}{' '}
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
