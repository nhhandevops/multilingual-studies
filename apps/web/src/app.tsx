import { useTranslation } from 'react-i18next';
import { Link, Route, Routes } from 'react-router-dom';
import { setUiLang } from './i18n';
import { useDb } from './db/provider';
import { Home } from './routes/home';
import { Browse } from './routes/browse';
import { WordPage } from './routes/word';
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
      {db.status.state === 'error' && (
        <p className="status error">
          {t('db.error')}: {db.status.message}
        </p>
      )}
      {db.status.state === 'ready' && (
        <>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/word/:id" element={<WordPage />} />
            <Route path="/licenses" element={<Licenses />} />
          </Routes>
          <footer className="pack">{t('db.packVersion', { version: db.status.packVersion })}</footer>
        </>
      )}
    </div>
  );
}
