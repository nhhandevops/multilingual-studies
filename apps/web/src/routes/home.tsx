import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useDb } from '../db/provider';
import { searchWords, type WordRow } from '../db/queries';
import { WordList } from '../components/word-list';

export function Home() {
  const { t } = useTranslation();
  const db = useDb();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [results, setResults] = useState<WordRow[] | null>(null);
  const [glosses, setGlosses] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    if (!q.trim()) {
      setResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      const words = await searchWords(db, q);
      if (cancelled) return;
      setResults(words);
      if (words.length > 0) {
        const ids = words.map((w) => w.id);
        const rows = await db.query<{ word_id: string; g: string }>(
          `SELECT word_id, group_concat(gloss_en, ' | ') AS g FROM senses
           WHERE word_id IN (${ids.map(() => '?').join(',')}) GROUP BY word_id`,
          ids,
        );
        if (!cancelled) setGlosses(new Map(rows.map((r) => [r.word_id, r.g])));
      }
    }, 150); // debounce
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, db]);

  return (
    <main>
      <input
        className="searchbox"
        autoFocus
        value={q}
        placeholder={t('search.placeholder')}
        onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
      />
      <p className="hint screen-intro">{t('search.hint')}</p>
      {results !== null && results.length === 0 && <p>{t('search.noResults', { q })}</p>}
      {results && <WordList words={results} glosses={glosses} />}
    </main>
  );
}
