import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Route, Routes } from 'react-router-dom';
import { setUiLang } from './i18n';
import { useDb } from './db/provider';
import { ensurePersisted } from './storage/persist';
import { pwa } from './pwa';
import { UpdateBanner } from './components/update-banner';
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
        <nav>
          <Link to="/">{t('nav.search')}</Link>
          <Link to="/today">{t('nav.today')}</Link>
          <Link to="/browse">{t('nav.browse')}</Link>
          <Link to="/review">{t('nav.review')}</Link>
          <Link to="/write">{t('nav.write')}</Link>
          <Link to="/pinyin">{t('nav.pinyin')}</Link>
          <Link to="/tones">{t('nav.tones')}</Link>
          <Link to="/ipa">{t('nav.ipa')}</Link>
          <Link to="/grammar">{t('nav.grammar')}</Link>
          <Link to="/tech">{t('nav.tech')}</Link>
          <Link to="/stats">{t('nav.stats')}</Link>
          <Link to="/licenses">{t('nav.licenses')}</Link>
        </nav>
        <div className="ui-lang" title={t('ui.language')}>
          <button className={i18n.language === 'vi' ? 'active' : ''} onClick={() => setUiLang('vi')}>
            VI
          </button>
          <button className={i18n.language === 'en' ? 'active' : ''} onClick={() => setUiLang('en')}>
            EN
          </button>
        </div>
      </header>

      {db.status.state === 'loading' && (
        <p className="status">
          {t(`db.phase.${db.status.phase}`, { defaultValue: t('db.loading'), mb: db.status.mb ?? '…' })}
        </p>
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
