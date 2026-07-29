import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './i18n';
import './styles.css';
import { DbProvider } from './db/provider';
import { App } from './app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DbProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </DbProvider>
  </StrictMode>,
);
