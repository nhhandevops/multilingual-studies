/**
 * One line of truth about where the learner's data stands:
 * durable-storage state (evictable vs persisted), current usage, and — when not yet
 * persisted — a button that asks the browser for durability.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ensurePersisted, persistState, usageMb, type PersistState } from '../storage/persist';

export function StorageStateLine() {
  const { t } = useTranslation();
  const [state, setState] = useState<PersistState | null>(null);
  const [mb, setMb] = useState<number | null>(null);

  const refresh = useCallback(() => {
    void persistState().then(setState);
    void usageMb().then(setMb);
  }, []);
  useEffect(refresh, [refresh]);

  if (state === null || state === 'unsupported') return null;
  return (
    <p className="hint">
      {state === 'persisted' ? t('storage.persisted') : t('storage.notPersisted')}
      {mb !== null && ` · ${t('storage.usage', { mb })}`}
      {state === 'not-persisted' && (
        <>
          {' '}
          <button
            className="linklike"
            onClick={() => {
              void ensurePersisted().then(() => refresh());
            }}
          >
            {t('storage.protect')}
          </button>
        </>
      )}
    </p>
  );
}
