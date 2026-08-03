/**
 * `/grammar` — browse grammar topics; `/grammar/:id` — read one.
 *
 * The three languages carry genuinely different content, and the reader is honest about which is
 * which rather than pretending they are uniform:
 *   zh — the OFFICIAL HSK syllabus (573 points, graded HSK1→7-9). The points are in Chinese and
 *        stay in Chinese; only the 12 top-level categories are localised, here in the UI.
 *        The good prose explanations live behind a NonCommercial licence, so each point offers an
 *        outbound link instead of text we are not allowed to bundle.
 *   fr — Tex's French Grammar in full (CC BY), in the site's own teaching order, some pages with
 *        a recorded example.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Markdown } from '../components/markdown';
import { SpeakButton } from '../components/speak-button';
import { Loading } from '../components/loading';
import { playAudio } from '../audio/player';
import { useDb } from '../db/provider';
import {
  getGrammar,
  grammarLangs,
  grammarLevels,
  grammarLinks,
  listGrammar,
  type GrammarRow,
} from '../db/queries';

/** An `audio:<id>` link is a bundled clip, not a URL to open. */
const audioIdOf = (url: string): string | null => (url.startsWith('audio:') ? url.slice(6) : null);

export function GrammarIndex() {
  const { t } = useTranslation();
  const db = useDb();
  const [langs, setLangs] = useState<{ lang: string; n: number }[]>([]);
  const [lang, setLang] = useState<string | null>(null);
  const [levels, setLevels] = useState<{ level: string; n: number }[]>([]);
  const [level, setLevel] = useState<string | undefined>();
  // `null` = still loading. Starting at [] made the count line read "0 chủ điểm" before the
  // query returned, which is a statement about the pack rather than about the wait.
  const [rows, setRows] = useState<GrammarRow[] | null>(null);
  const [tooOld, setTooOld] = useState(false);

  useEffect(() => {
    void grammarLangs(db)
      .then((l) => {
        setLangs(l);
        if (l.length === 0) setTooOld(true);
        else setLang((cur) => cur ?? l[0]!.lang);
      })
      .catch(() => setTooOld(true));
  }, [db]);

  useEffect(() => {
    if (!lang) return;
    setLevel(undefined);
    void grammarLevels(db, lang).then(setLevels);
  }, [lang, db]);

  useEffect(() => {
    if (!lang) return;
    let cancelled = false;
    setRows(null);
    void listGrammar(db, lang, level)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch(() => {
        if (!cancelled) setRows([]); //  land the sentinel on failure
      });
    return () => {
      cancelled = true;
    };
  }, [lang, level, db]);

  if (tooOld) return <main><p className="status">{t('db.packTooOld')}</p></main>;

  return (
    <main className="grammar-index">
      <h2>{t('grammar.title')}</h2>
      <p className="hint screen-intro">{t('grammar.intro')}</p>
      <div className="chips langs">
        {langs.map((l) => (
          <button key={l.lang} className={l.lang === lang ? 'active' : ''} onClick={() => setLang(l.lang)}>
            {t(`lang.${l.lang}`, l.lang)} <span className="muted">{l.n}</span>
          </button>
        ))}
      </div>
      {levels.length > 0 && (
        <div className="chips levels">
          <button className={level === undefined ? 'active' : ''} onClick={() => setLevel(undefined)}>
            {t('grammar.allLevels')}
          </button>
          {levels.map((l) => (
            <button key={l.level} className={l.level === level ? 'active' : ''} onClick={() => setLevel(l.level)}>
              {l.level} <span className="muted">{l.n}</span>
            </button>
          ))}
        </div>
      )}
      {rows === null && <Loading />}
      {rows !== null && <p className="hint">{t('grammar.count', { n: rows.length })}</p>}
      <ol className="grammar-list">
        {(rows ?? []).map((r) => (
          <li key={r.id}>
            <Link to={`/grammar/${encodeURIComponent(r.id)}`}>{r.title_vi ?? r.title_en}</Link>
            {r.level && <span className="badge">{r.level}</span>}
            {r.license_mode === 'link-only' && <span className="badge link-only">{t('grammar.linkOnly')}</span>}
          </li>
        ))}
      </ol>
    </main>
  );
}

export function GrammarPage() {
  const { t } = useTranslation();
  const db = useDb();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<GrammarRow | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    setRow('loading');
    if (!id) return;
    void getGrammar(db, id).then((r) => {
      if (!cancelled) setRow(r);
    });
    return () => {
      cancelled = true;
    };
  }, [id, db]);

  if (row === 'loading') return <Loading />;
  if (!row)
    return (
      <main>
        <p>{t('grammar.notFound')}</p>
        <Link to="/grammar">{t('grammar.back')}</Link>
      </main>
    );

  const links = grammarLinks(row);
  const clips = links.map((l) => audioIdOf(l.url)).filter((a): a is string => a !== null);
  const outbound = links.filter((l) => audioIdOf(l.url) === null);

  return (
    <main className="grammar-detail">
      <p>
        <button className="linklike" onClick={() => navigate(-1)}>
          {t('grammar.back')}
        </button>
      </p>
      <h2>{row.title_vi ?? row.title_en}</h2>
      <p>
        {row.level && <span className="badge">{row.level}</span>}
        <span className="badge">{t(`lang.${row.lang}`, row.lang)}</span>
        {clips.map((a) => (
          <button key={a} className="speak" title={t('word.listen')} aria-label={t('word.listen')} onClick={() => void playAudio(db, a)}>
            🔊
          </button>
        ))}
      </p>

      {row.license_mode === 'link-only' ? (
        // Never render body text for a link-only source even if a future seed wrongly stores it.
        <p className="hint">{t('grammar.linkOnlyBody')}</p>
      ) : row.body_md ? (
        <Markdown body={row.body_md} />
      ) : (
        <p className="hint">{t('grammar.noBody')}</p>
      )}

      {/* The grammar text has no bundled narration beyond a few examples — TTS reads the point
          aloud for everything else, exactly as it does for example sentences. */}
      {row.lang !== 'zh' && clips.length === 0 && (
        <SpeakButton db={db} audio={null} text={row.title_en} lang={row.lang} variant="block" />
      )}

      {outbound.length > 0 && (
        <p className="hint">
          {t('grammar.readMore')}:{' '}
          {outbound.map((l, i) => (
            <span key={l.url}>
              {i > 0 && ' · '}
              <a href={l.url} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            </span>
          ))}
        </p>
      )}
      <p className="hint">
        {t('word.source')}:{' '}
        <a href={row.source_url} target="_blank" rel="noreferrer">
          {row.source_name}
        </a>{' '}
        ({row.license})
      </p>
    </main>
  );
}
