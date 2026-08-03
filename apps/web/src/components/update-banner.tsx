/**
 * One banner for both update kinds:
 *  - a new APP SHELL waiting in the service worker (pwa store, needRefresh) → activate + reload
 *  - a new CONTENT PACK on the server (db.update) → plain reload; the worker's boot path is
 *    the verified installer (sha check, never-brick guard), so "apply" IS a reload
 *  - the pack requires a NEWER APP (needsAppUpdate) → explain; reload picks up both
 */
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useDb } from '../db/provider';
import { pwa } from '../pwa';

export function UpdateBanner() {
  const { t } = useTranslation();
  const db = useDb();
  const needRefresh = useSyncExternalStore(pwa.subscribe, pwa.getNeedRefresh, () => false);
  const update = db.update;

  if (!needRefresh && !update) return null;

  const packMb = update?.coreBytes ? Math.round(update.coreBytes / 1024 / 1024) : null;
  const label = needRefresh
    ? t('update.app')
    : update?.needsAppUpdate
      ? t('update.needsApp')
      : t('update.pack', { version: update?.packVersion, mb: packMb });

  const apply = () => {
    if (needRefresh) {
      void pwa.applyUpdate(); // activates the waiting SW, then reloads
    } else if (update?.needsAppUpdate) {
      // The pack needs a newer APP. Reloading would re-serve the old precached shell, so
      // fetch the new service worker instead; when it reaches waiting, this banner flips
      // to the needRefresh branch, whose applyUpdate() genuinely swaps the shell. Do NOT
      // check getNeedRefresh() here: reg.update() resolves at "installing", before the
      // new SW precaches and reaches "waiting", so the flag is always still false at that
      // moment and the reload would serve the old shell — a dead-looking two-click update.
      // Reload only when NO service worker handled the check at all (dev, unsupported).
      void pwa.checkForUpdate().then((handled) => {
        if (!handled) window.location.reload();
      });
    } else {
      window.location.reload(); // boot path installs the new pack
    }
  };

  return (
    <div className="update-banner" role="status">
      <span>{label}</span>
      <button onClick={apply}>{t('update.apply')}</button>
    </div>
  );
}
