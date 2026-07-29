import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import vi from './vi.json';

const stored = localStorage.getItem('ui_lang');

void i18next.use(initReactI18next).init({
  resources: { vi: { translation: vi }, en: { translation: en } },
  lng: stored === 'en' ? 'en' : 'vi', // Vietnamese-first
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function setUiLang(lang: 'vi' | 'en'): void {
  localStorage.setItem('ui_lang', lang);
  void i18next.changeLanguage(lang);
  document.documentElement.lang = lang;
}

export default i18next;
