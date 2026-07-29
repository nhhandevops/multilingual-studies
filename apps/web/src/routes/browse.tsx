import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDb } from '../db/provider';
import { browseWords, listLevels, type WordRow } from '../db/queries';
import { WordList } from '../components/word-list';

const LANGS = ['zh', 'en', 'fr'] as const;
const PAGE = 50;

export function Browse() {
  const { t } = useTranslation();
  const db = useDb();
  const [lang, setLang] = useState<string>('zh');
  const [levels, setLevels] = useState<{ level: string; n: number }[]>([]);
  const [level, setLevel] = useState<string | null>(null);
  const [words, setWords] = useState<WordRow[]>([]);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    void listLevels(db, lang).then(setLevels);
    setLevel(null);
    setOffset(0);
  }, [lang, db]);

  useEffect(() => {
    let cancelled = false;
    void browseWords(db, lang, level, 0, PAGE).then((w) => {
      if (!cancelled) {
        setWords(w);
        setOffset(PAGE);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [lang, level, db]);

  const more = async () => {
    const next = await browseWords(db, lang, level, offset, PAGE);
    setWords((w) => [...w, ...next]);
    setOffset((o) => o + PAGE);
  };

  return (
    <main>
      <h2>{t('browse.title')}</h2>
      <div className="chips">
        {LANGS.map((l) => (
          <button key={l} className={lang === l ? 'active' : ''} onClick={() => setLang(l)}>
            {t(`lang.${l}`)}
          </button>
        ))}
      </div>
      {levels.length > 0 ? (
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
      <WordList words={words} />
      {words.length >= PAGE && (
        <button className="more" onClick={() => void more()}>
          {t('browse.more')}
        </button>
      )}
    </main>
  );
}
