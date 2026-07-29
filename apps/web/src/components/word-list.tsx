import { Link } from 'react-router-dom';
import type { WordRow } from '../db/queries';

/** Shared result-row list. gloss comes pre-joined from a summary query when available. */
export function WordList({ words, glosses }: { words: WordRow[]; glosses?: Map<string, string> }) {
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
        </li>
      ))}
    </ul>
  );
}
