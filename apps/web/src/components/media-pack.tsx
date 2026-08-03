/**
 * Install/remove control for the optional media pack (word-pronunciation recordings).
 *
 * The core pack ships every word's METADATA (speaker, credit) but, since v0.9, the mp3 bytes
 * for word audio live in a second, opt-in download — a phone install is ~58 MB instead of
 * ~130 MB. Presence of the file IS the setting; there is no separate toggle to get stale.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDb } from '../db/provider';

export function MediaPackControl() {
  const { t } = useTranslation();
  const db = useDb();
  const [error, setError] = useState<string | null>(null);

  const { installed, availableBytes, busy } = db.media;
  if (!installed && availableBytes === null) return null; // manifest has no media pack (old server)

  const mb = availableBytes !== null ? Math.round(availableBytes / 1024 / 1024) : null;

  return (
    <div className="media-pack">
      <h3>{t('media.title')}</h3>
      <p className="hint">{installed ? t('media.installedHint') : t('media.hint', { mb })}</p>
      {busy ? (
        <p className="hint">{t(`media.busy.${busy}`, t('media.busy.download'))}</p>
      ) : installed ? (
        <button
          onClick={() => {
            setError(null);
            void db.removeMedia().catch((e: Error) => setError(e.message));
          }}
        >
          {t('media.remove')}
        </button>
      ) : (
        <button
          onClick={() => {
            setError(null);
            void db.installMedia().catch((e: Error) => setError(e.message));
          }}
        >
          {t('media.install', { mb })}
        </button>
      )}
      {error && <p className="error">{t('media.error')}: {error}</p>}
    </div>
  );
}

/**
 * One-line inline nudge shown where the value is visible: a word that HAS a recording,
 * rendered while the media pack is absent. Dismiss = this session only (deliberately cheap —
 * a settings write per banner would outlive its usefulness).
 */
let dismissedThisSession = false;

export function MediaHint() {
  const { t } = useTranslation();
  const db = useDb();
  const [dismissed, setDismissed] = useState(dismissedThisSession);
  const [error, setError] = useState<string | null>(null);
  const { installed, availableBytes, busy } = db.media;

  if (installed || availableBytes === null || dismissed) return null;
  const mb = Math.round(availableBytes / 1024 / 1024);

  return (
    <p className="media-hint hint">
      {t('media.wordHint', { mb })}{' '}
      {busy ? (
        t(`media.busy.${busy}`, t('media.busy.download'))
      ) : (
        <>
          <button
            className="linklike"
            onClick={() => {
              setError(null);
              void db.installMedia().catch((e: Error) => setError(e.message));
            }}
          >
            {t('media.installShort')}
          </button>{' '}
          <button
            className="linklike"
            onClick={() => {
              dismissedThisSession = true;
              setDismissed(true);
            }}
          >
            {t('media.dismiss')}
          </button>
        </>
      )}
      {error && <span className="error"> {t('media.error')}</span>}
    </p>
  );
}
