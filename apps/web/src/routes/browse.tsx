import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDb } from '../db/provider';
import { browseWords, listLevels, type WordRow } from '../db/queries';
import { deckIds } from '../db/user-queries';
import { WordList } from '../components/word-list';
import { Loading } from '../components/loading';

const LANGS = ['zh', 'en', 'fr'] as const;
const PAGE = 50;

export function Browse() {
  const { t } = useTranslation();
  const db = useDb();
  const [lang, setLang] = useState<string>('zh');
  // `null` = not answered yet, `[]` = this language really has no levels / no words. Rendering
  // "no levels" or an empty list before the query returns reads as missing data, not as loading.
  const [levels, setLevels] = useState<{ level: string; n: number }[] | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [words, setWords] = useState<WordRow[] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deck, setDeck] = useState<Set<string>>(new Set());
  const epoch = useRef(''); // identifies the {lang,level} the current list belongs to

  useEffect(() => {
    setLevels(null);
    void listLevels(db, lang)
      .then(setLevels)
      .catch(() => setLevels([])); //  resolve the sentinel; a null that never lands spins forever
    setLevel(null);
  }, [lang, db]);

  useEffect(() => {
    let cancelled = false;
    epoch.current = `${lang}|${level}`;
    setWords(null); //  switching language or level starts a new wait
    void browseWords(db, lang, level, 0, PAGE)
      .then(async (w) => {
        if (cancelled) return;
        setWords(w);
        const inDeck = await deckIds(db, w.map((x) => x.id));
        if (!cancelled) setDeck(inDeck);
      })
      .catch(() => {
        if (!cancelled) setWords([]);
      });
    return () => {
      cancelled = true;
    };
  }, [lang, level, db]);

  const more = async () => {
    if (loadingMore) return; // double-click must not duplicate a page
    setLoadingMore(true);
    const key = epoch.current;
    try {
      // offset derives from what's rendered, never from a stale closure counter
      const next = await browseWords(db, lang, level, words?.length ?? 0, PAGE);
      if (epoch.current !== key) return; // lang/level switched mid-flight — drop the result
      setWords((w) => [...(w ?? []), ...next]);
      const inDeck = await deckIds(db, next.map((x) => x.id));
      if (epoch.current === key) setDeck((d) => new Set([...d, ...inDeck]));
    } finally {
      setLoadingMore(false);
    }
  };

  const onDeckChange = (id: string, inDeck: boolean) => {
    setDeck((d) => {
      const next = new Set(d);
      if (inDeck) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <main>
      <h2>{t('browse.title')}</h2>
      <p className="hint screen-intro">{t('browse.intro')}</p>
      <div className="chips">
        {LANGS.map((l) => (
          <button key={l} className={lang === l ? 'active' : ''} onClick={() => setLang(l)}>
            {t(`lang.${l}`)}
          </button>
        ))}
      </div>
      {levels === null ? null : levels.length > 0 ? (
        <div className="chips">
          <button className={level === null ? 'active' : ''} onClick={() => setLevel(null)}>
            {t('browse.allLevels')}
          </button>
          {levels.map((l) => (
            <button key={l.level} className={level === l.level ? 'active' : ''} onClick={() => setLevel(l.level)}>
              {l.level} ({l.n})
            </button>
          ))}
        </div>
      ) : (
        <p className="hint">{t('browse.noLevels')}</p>
      )}
      {words === null ? <Loading /> : <WordList words={words} deck={deck} onDeckChange={onDeckChange} />}
      {words !== null && words.length >= PAGE && (
        <button className="more" disabled={loadingMore} onClick={() => void more()}>
          {t('browse.more')}
        </button>
      )}
    </main>
  );
}
