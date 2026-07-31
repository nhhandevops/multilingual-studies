import { useTranslation } from 'react-i18next';
import { Link, Route, Routes } from 'react-router-dom';
import { setUiLang } from './i18n';
import { useDb } from './db/provider';
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
import { Licenses } from './routes/licenses';

export function App() {
  const { t, i18n } = useTranslation();
  const db = useDb();

  return (
    <div className="shell">
      <header className="top">
        <h1>
          <Link to="/">{t('app.title')}</Link>
        </h1>
        <nav>
          <Link to="/">{t('nav.search')}</Link>
          <Link to="/browse">{t('nav.browse')}</Link>
          <Link to="/review">{t('nav.review')}</Link>
          <Link to="/write">{t('nav.write')}</Link>
          <Link to="/pinyin">{t('nav.pinyin')}</Link>
          <Link to="/tones">{t('nav.tones')}</Link>
          <Link to="/ipa">{t('nav.ipa')}</Link>
          <Link to="/grammar">{t('nav.grammar')}</Link>
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

      {db.status.state === 'loading' && <p className="status">{t(`db.phase.${db.status.phase}`, t('db.loading'))}</p>}
      {db.status.state === 'error' &&
        (db.status.message.startsWith('storage-locked') ? (
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
            <Route path="/licenses" element={<Licenses />} />
          </Routes>
          <footer className="pack">{t('db.packVersion', { version: db.status.packVersion })}</footer>
        </>
      )}
    </div>
  );
}
