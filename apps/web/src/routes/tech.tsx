/**
 * `/tech` — the professional vocabulary module; `/tech/:id` — one term.
 *
 * The design premise is the roadmap's own sentence: "learn firmware/固件/micrologiciel with a
 * Vietnamese label". A term is not a word to translate but a CONCEPT with a name in each
 * language, so the list shows all four names side by side — and shows a missing name as a gap
 * rather than hiding the row. The gaps are real data: they are the terms where Wikidata's
 * Vietnamese coverage runs out, and pretending otherwise would just relocate the surprise to
 * the middle of a review session.
 *
 * Definitions are English on purpose. NIST and Wikipedia write them in English; the module's
 * user reads technical English at work. `title_vi`-style machine translation was rejected in
 * v0.5 for grammar and is rejected here for the same reason.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SpeakButton } from '../components/speak-button';
import { Loading } from '../components/loading';
import { useDb } from '../db/provider';
import {
  getTechTerm,
  labelAliases,
  listTechTerms,
  techDomains,
  type TechLabelRow,
  type TechTermRow,
} from '../db/queries';
import { addTechCard, deckIds, removeCard } from '../db/user-queries';
import { srsNow } from '../srs/clock';

type TermWithLabels = TechTermRow & { labels: TechLabelRow[] };

const labelOf = (t: TermWithLabels, lang: string): string | null =>
  t.labels.find((l) => l.lang === lang)?.label ?? null;

export function TechIndex() {
  const { t } = useTranslation();
  const db = useDb();
  const [terms, setTerms] = useState<TermWithLabels[]>([]);
  const [domains, setDomains] = useState<{ domain: string; n: number }[]>([]);
  const [domain, setDomain] = useState<string | undefined>();
  const [query, setQuery] = useState('');
  const [deck, setDeck] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [list, doms] = await Promise.all([listTechTerms(db, domain), techDomains(db)]);
        if (cancelled) return;
        setTerms(list);
        setDomains(doms);
        setLoaded(true);
        setDeck(await deckIds(db, list.map((x) => x.id)));
      } catch {
        if (!cancelled) setLoaded(true); //  a failure is an answer; never leave the spinner up
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, domain]);

  // Search across every language's name and aliases: an engineer looking for 单片机 must find
  // the row whose label is 微控制器 — that everyday-vs-encyclopedic split is why aliases exist.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return terms;
    return terms.filter(
      (x) =>
        x.term.toLowerCase().includes(q) ||
        x.labels.some(
          (l) => l.label.toLowerCase().includes(q) || labelAliases(l).some((a) => a.toLowerCase().includes(q)),
        ),
    );
  }, [terms, query]);

  if (loaded && terms.length === 0 && !domain)
    return (
      <main>
        <p className="status">{t('db.packTooOld')}</p>
      </main>
    );

  const toggle = async (x: TermWithLabels) => {
    if (deck.has(x.id)) return;
    const packVersion = db.status.state === 'ready' ? db.status.packVersion : '';
    await addTechCard(db, x, x.labels, packVersion, srsNow());
    setDeck((prev) => new Set(prev).add(x.id));
  };

  return (
    <main className="tech-index">
      <h2>{t('tech.title')}</h2>
      <p className="hint">{t('tech.subtitle')}</p>
      {domains.length > 1 && (
        <div className="chips domains">
          <button className={domain === undefined ? 'active' : ''} onClick={() => setDomain(undefined)}>
            {t('tech.allDomains')}
          </button>
          {domains.map((d) => (
            <button key={d.domain} className={d.domain === domain ? 'active' : ''} onClick={() => setDomain(d.domain)}>
              {d.domain} <span className="muted">{d.n}</span>
            </button>
          ))}
        </div>
      )}
      <input
        className="searchbox tech-search"
        placeholder={t('tech.searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!loaded && <Loading />}
      {loaded && <p className="hint">{t('tech.count', { n: shown.length })}</p>}
      <ul className="tech-list">
        {shown.map((x) => (
          <li key={x.id}>
            <Link to={`/tech/${encodeURIComponent(x.id)}`}>
              <span className="hw">{x.term}</span>
              <span className="tech-cell zh">{labelOf(x, 'zh') ?? '—'}</span>
              <span className="tech-cell fr">{labelOf(x, 'fr') ?? '—'}</span>
              <span className="tech-cell vi">{labelOf(x, 'vi') ?? '—'}</span>
            </Link>
            <button
              className={`deck-btn${deck.has(x.id) ? ' in-deck' : ''}`}
              disabled={deck.has(x.id)}
              title={deck.has(x.id) ? t('deck.added') : t('deck.add')}
              aria-label={deck.has(x.id) ? t('deck.added') : t('deck.add')}
              onClick={() => void toggle(x)}
            >
              {deck.has(x.id) ? '✓' : '＋'}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

export function TechTermPage() {
  const { t } = useTranslation();
  const db = useDb();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<TermWithLabels | null | 'loading'>('loading');
  const [inDeck, setInDeck] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRow('loading');
    if (!id) return;
    void (async () => {
      const r = await getTechTerm(db, id);
      if (cancelled) return;
      setRow(r);
      if (r) setInDeck((await deckIds(db, [r.id])).has(r.id));
    })();
    return () => {
      cancelled = true;
    };
  }, [id, db]);

  if (row === 'loading') return <Loading />;
  if (!row)
    return (
      <main>
        <p>{t('tech.notFound')}</p>
        <Link to="/tech">{t('tech.back')}</Link>
      </main>
    );

  const toggle = async () => {
    if (inDeck) {
      await removeCard(db, row.id);
      setInDeck(false);
    } else {
      const packVersion = db.status.state === 'ready' ? db.status.packVersion : '';
      await addTechCard(db, row, row.labels, packVersion, srsNow());
      setInDeck(true);
    }
  };

  return (
    <main className="tech-detail">
      <p>
        <button className="linklike" onClick={() => navigate(-1)}>
          {t('tech.back')}
        </button>
      </p>
      <h2>
        {row.term} <SpeakButton db={db} audio={null} text={row.term} lang="en" />
      </h2>
      {row.domain && <p className="hint">{row.domain}</p>}

      <dl className="tech-langs">
        {(['vi', 'zh', 'fr'] as const).map((lang) => {
          const l = row.labels.find((x) => x.lang === lang);
          const aliases = l ? labelAliases(l) : [];
          return (
            <div key={lang} className="tech-lang-row">
              <dt>{t(`lang.${lang}`, lang)}</dt>
              <dd>
                {l ? (
                  <>
                    <span className="hw">{l.label}</span>
                    {lang !== 'vi' && <SpeakButton db={db} audio={null} text={l.label} lang={lang} />}
                    {/* Aliases matter here more than anywhere: Wikidata's label is the
                        encyclopedic title, and the term an engineer actually says is often an
                        alias (单片机 for microcontroller, not 微控制器). */}
                    {aliases.length > 0 && <span className="muted"> · {aliases.join(' · ')}</span>}
                  </>
                ) : (
                  // A gap is information: this concept has no recorded name in that language.
                  <span className="muted">{t('tech.noLabel')}</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <h3>{t('tech.definition')}</h3>
      <p className="tech-def">{row.definition}</p>

      <button className={`deck-btn labeled${inDeck ? ' in-deck' : ''}`} onClick={() => void toggle()}>
        {inDeck ? `✓ ${t('deck.remove')}` : `＋ ${t('deck.add')}`}
      </button>

      {row.attribution && <p className="hint attribution">{row.attribution}</p>}
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
