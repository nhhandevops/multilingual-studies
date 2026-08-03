import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { setUiLang } from './i18n';
import { useDb } from './db/provider';
import { ensurePersisted } from './storage/persist';
import { pwa } from './pwa';
import { UpdateBanner } from './components/update-banner';
import { Loading } from './components/loading';
import { BackupNag } from './components/backup-nag';
import { IosA2hs } from './components/ios-a2hs';
import { Home } from './routes/home';
import { Browse } from './routes/browse';
import { WordPage } from './routes/word';
import { Review } from './routes/review';
import { WriteIndex } from './routes/write';
import { GlyphPage } from './routes/glyph';
import { PinyinChart } from './routes/pinyin';
import { ToneDrill } from './routes/tones';
import { IpaChart } from './routes/ipa';
import { GrammarIndex, GrammarPage } from './routes/grammar';
import { Today, DailyItemPage } from './routes/today';
import { TechIndex, TechTermPage } from './routes/tech';
import { Stats } from './routes/stats';
import { Licenses } from './routes/licenses';

export function App() {
  const { t, i18n } = useTranslation();
  const db = useDb();
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);

  // A word page has no tab of its own, so the search tab claims it. This is a deliberate
  // approximation, not a fact: /word/:id is also reached from Browse, Review, Today and glyph
  // pages, so after a Browse click the lit tab is arguably wrong. Leaving NO tab lit is worse
  // for the beginner this exists for — a highlight that sometimes over-claims still answers
  // "where am I" better than a header with nothing lit at all.
  const searchActive = pathname === '/' || pathname.startsWith('/word/');

  // Keep the lit tab on screen. The strip is ~1103px wide inside a 390px (or 780px) viewport,
  // so on arrival the highlight is frequently scrolled out of view — and a highlight you cannot
  // see is not a fix. scrollBy on the strip, never scrollIntoView (which would also scroll the
  // page vertically); rect-based, never offsetLeft (the nav is unpositioned, so the anchors'
  // offsetParent is <body> and the math is wrong by the centred shell's margin above 780px).
  // Instant, not smooth: animation on every navigation makes Playwright wait for stability
  // across the suite's 50+ nav clicks.
  useEffect(() => {
    const nav = navRef.current;
    // The header renders OUTSIDE the `state === 'ready'` gate, so this runs during loading and
    // error states too, when no tab is lit.
    const active = nav?.querySelector<HTMLAnchorElement>('a.active');
    if (!nav || !active) return;
    const a = active.getBoundingClientRect();
    const n = nav.getBoundingClientRect();
    nav.scrollBy({ left: a.left - n.left - (n.width - a.width) / 2 });
  }, [pathname]);

  // Durable storage is requested on the first user.db WRITE (see provider) — by then the
  // learner has something to lose and the browser prompt makes sense. Here we only cover
  // the install event: Chrome grants installed origins near-automatically.
  useEffect(() => {
    const onInstalled = () => void ensurePersisted();
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  // Storage-lock auto-recovery.
  //
  // The outgoing document can hold the exclusive OPFS handles for ~20 s after a reload
  // (measured, worst case: it had been playing audio), and once this document's pool install
  // has failed, retrying inside it never succeeds — only a FRESH document does. So reload
  // ourselves, once, instead of dead-ending on a button the learner has to find. The
  // sessionStorage guard makes it exactly one attempt: a genuine second tab still gets the
  // manual screen rather than an infinite reload loop.
  const errorMessage = db.status.state === 'error' ? db.status.message : null;
  useEffect(() => {
    if (!errorMessage?.startsWith('storage-locked')) return;
    if (sessionStorage.getItem('mls_lock_recovery') === '1') return;
    sessionStorage.setItem('mls_lock_recovery', '1');
    const timer = setTimeout(() => window.location.reload(), 2000);
    return () => clearTimeout(timer);
  }, [errorMessage]);
  useEffect(() => {
    if (db.status.state === 'ready') sessionStorage.removeItem('mls_lock_recovery');
  }, [db.status.state]);

  return (
    <div className="shell">
      <header className="top">
        <h1>
          <Link to="/">{t('app.title')}</Link>
        </h1>
        {/* .ui-lang sits BEFORE the nav in the DOM because the nav now claims a full flex row;
            leaving the toggle after it pushed the header onto a third line. */}
        <div className="ui-lang" title={t('ui.language')}>
          <button className={i18n.language === 'vi' ? 'active' : ''} onClick={() => setUiLang('vi')}>
            VI
          </button>
          <button className={i18n.language === 'en' ? 'active' : ''} onClick={() => setUiLang('en')}>
            EN
          </button>
        </div>
        <nav ref={navRef} aria-label={t('nav.label')}>
          {/* Search stays a plain Link with a hand-computed active state. NavLink cannot express
              this: `end` would go dark on /word/:id, and a NavLink with a custom className but
              isActive=false drops aria-current — so it would highlight visually while telling a
              screen reader nothing. The other eleven are NavLinks with NO `end`, because the
              prefix match is exactly what keeps the parent tab lit on /write/:glyph,
              /grammar/:id, /today/:id and /tech/:id. Prefix collisions are impossible: the
              router requires a '/' boundary after the match, so /tones never lights /today. */}
          <Link to="/" className={searchActive ? 'active' : ''} aria-current={searchActive ? 'page' : undefined}>
            {t('nav.search')}
          </Link>
          <NavLink to="/today">{t('nav.today')}</NavLink>
          <NavLink to="/browse">{t('nav.browse')}</NavLink>
          <NavLink to="/review">{t('nav.review')}</NavLink>
          <NavLink to="/write">{t('nav.write')}</NavLink>
          <NavLink to="/pinyin">{t('nav.pinyin')}</NavLink>
          <NavLink to="/tones">{t('nav.tones')}</NavLink>
          <NavLink to="/ipa">{t('nav.ipa')}</NavLink>
          <NavLink to="/grammar">{t('nav.grammar')}</NavLink>
          <NavLink to="/tech">{t('nav.tech')}</NavLink>
          <NavLink to="/stats">{t('nav.stats')}</NavLink>
          <NavLink to="/licenses">{t('nav.licenses')}</NavLink>
        </nav>
      </header>

      {db.status.state === 'loading' && (
        // The boot loader keeps its richer line (which phase, how many MB) and borrows the
        // spinner. Both t() options are load-bearing: `defaultValue` covers a phase with no
        // string yet, and `mb` fills {{mb}} in db.phase.download.
        <Loading
          label={t(`db.phase.${db.status.phase}`, { defaultValue: t('db.loading'), mb: db.status.mb ?? '…' })}
        />
      )}
      {db.status.state === 'error' &&
        (db.status.message.startsWith('app-too-old') ? (
          // The server's pack needs a newer app and there is no installed pack to fall back
          // on. A bare reload would re-serve the OLD precached shell, so activate the waiting
          // service worker when there is one — that is what actually escapes this state.
          <div className="status">
            <p className="error">{t('db.appTooOld')}</p>
            <button
              className="more"
              onClick={() => {
                if (pwa.getNeedRefresh()) void pwa.applyUpdate();
                else void pwa.checkForUpdate().then(() => window.location.reload());
              }}
            >
              {t('db.reload')}
            </button>
          </div>
        ) : db.status.message.startsWith('storage-locked') ? (
          // Another document (a second tab, or a page frozen in the back/forward cache) holds
          // the exclusive OPFS handles. Reloading takes them over; the raw error helps nobody.
          <div className="status">
            <p className="error">{t('db.locked')}</p>
            <button className="more" onClick={() => window.location.reload()}>
              {t('db.reload')}
            </button>
          </div>
        ) : (
          <p className="status error">
            {t('db.error')}: {db.status.message}
          </p>
        ))}
      {db.status.state === 'ready' && (
        <>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/word/:id" element={<WordPage />} />
            <Route path="/review" element={<Review />} />
            <Route path="/write" element={<WriteIndex />} />
            <Route path="/write/:glyph" element={<GlyphPage />} />
            <Route path="/pinyin" element={<PinyinChart />} />
            <Route path="/tones" element={<ToneDrill />} />
            <Route path="/ipa" element={<IpaChart />} />
            <Route path="/grammar" element={<GrammarIndex />} />
            <Route path="/grammar/:id" element={<GrammarPage />} />
            <Route path="/today" element={<Today />} />
            <Route path="/today/:id" element={<DailyItemPage />} />
            <Route path="/tech" element={<TechIndex />} />
            <Route path="/tech/:id" element={<TechTermPage />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/licenses" element={<Licenses />} />
          </Routes>
          <UpdateBanner />
          <BackupNag />
          <IosA2hs />
          <footer className="pack">{t('db.packVersion', { version: db.status.packVersion })}</footer>
        </>
      )}
    </div>
  );
}
