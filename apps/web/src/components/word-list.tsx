import { Link } from 'react-router-dom';
import type { WordRow } from '../db/queries';
import { AddToDeck } from './add-to-deck';

/**
 * Shared result-row list. gloss comes pre-joined from a summary query when available.
 * Pass `deck` (ids already in the SRS deck) to show an add-to-deck button per row —
 * the button sits NEXT TO the Link, never inside it.
 */
export function WordList({
  words,
  glosses,
  deck,
  onDeckChange,
}: {
  words: WordRow[];
  glosses?: Map<string, string>;
  deck?: Set<string>;
  onDeckChange?: (id: string, inDeck: boolean) => void;
}) {
  if (words.length === 0) return null;
  return (
    <ul className="words">
      {words.map((w) => (
        <li key={w.id}>
          <Link to={`/word/${encodeURIComponent(w.id)}`}>
            <span className="badge">{w.lang.toUpperCase()}</span>
            <span className="hw">{w.headword}</span>
            {w.alt_form && w.alt_form !== w.headword && <span className="hw">{w.alt_form}</span>}
            {w.reading && <span className="reading">{w.reading}</span>}
            <span className="gloss">{glosses?.get(w.id) ?? ''}</span>
            {w.level && <span className="badge">{w.level}</span>}
          </Link>
          {deck && (
            <AddToDeck compact word={w} inDeck={deck.has(w.id)} onChange={(v) => onDeckChange?.(w.id, v)} />
          )}
        </li>
      ))}
    </ul>
  );
}
