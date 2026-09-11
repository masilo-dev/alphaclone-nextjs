import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { uiTranslate } from './uiTranslate';
import type { SupportedLanguage } from './languages';

const resources = {
  en: { translation: {} },
  es: { translation: {} },
  pl: { translation: {} },
};

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: 'en',
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
    });
}

export function translate(lang: SupportedLanguage, key: string): string {
  return uiTranslate(lang, key);
}

export default i18n;
