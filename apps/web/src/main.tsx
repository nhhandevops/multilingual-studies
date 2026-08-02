import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './i18n';
import './styles.css';
import './pwa';
import { DbProvider } from './db/provider';
import { App } from './app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DbProvider>
      {/* basename tracks vite's base — '/' locally, '/multilingual-studies/' on GitHub Pages */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </DbProvider>
  </StrictMode>,
);
