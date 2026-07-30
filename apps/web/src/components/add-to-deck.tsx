import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDb } from '../db/provider';
import { listSenses, type SenseRow, type WordRow } from '../db/queries';
import { addCard, removeCard } from '../db/user-queries';
import { srsNow } from '../srs/clock';

/**
 * Add-to-deck toggle. `compact` renders the icon-only variant for list rows;
 * the default renders a labeled button for the word page. Senses are fetched
 * on demand when the caller doesn't already have them (list rows).
 */
export function AddToDeck({
  word,
  senses,
  inDeck,
  onChange,
  compact = false,
}: {
  word: WordRow;
  senses?: SenseRow[];
  inDeck: boolean;
  onChange?: (inDeck: boolean) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const db = useDb();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (inDeck) {
        await removeCard(db, word.id);
        onChange?.(false);
      } else {
        const s = senses ?? (await listSenses(db, word.id));
        const packVersion = db.status.state === 'ready' ? db.status.packVersion : '';
        await addCard(db, word, s, packVersion, srsNow());
        onChange?.(true);
      }
    } finally {
      setBusy(false);
    }
  };

  // Compact rows are add-only: removing belongs on the word page, where it can't be fat-fingered.
  if (compact) {
    return (
      <button
        className={`deck-btn${inDeck ? ' in-deck' : ''}`}
        disabled={busy || inDeck}
        title={inDeck ? t('deck.added') : t('deck.add')}
        aria-label={inDeck ? t('deck.added') : t('deck.add')}
        onClick={() => void toggle()}
      >
        {inDeck ? '✓' : '＋'}
      </button>
    );
  }

  return (
    <button className={`deck-btn labeled${inDeck ? ' in-deck' : ''}`} disabled={busy} onClick={() => void toggle()}>
      {inDeck ? `✓ ${t('deck.remove')}` : `＋ ${t('deck.add')}`}
    </button>
  );
}
