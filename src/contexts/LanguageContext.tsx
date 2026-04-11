'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LANGUAGES, LANGUAGE_STORAGE_KEY, type SupportedLanguage } from '@/i18n/languages';
import { uiTranslate } from '@/i18n/uiTranslate';

export type { SupportedLanguage };
export { LANGUAGES, LANGUAGE_STORAGE_KEY };

interface LanguageContextType {
    language: SupportedLanguage;
    setLanguage: (lang: SupportedLanguage) => void;
    languageLabel: string;
    /** Short code for UI badges, e.g. EN */
    languageCode: string;
    /** Translate dashboard shell / shared copy (English source string). */
    t: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
    language: 'en',
    setLanguage: () => {},
    languageLabel: 'English',
    languageCode: 'EN',
    t: (s) => s,
});

export const useLanguage = (): LanguageContextType => useContext(LanguageContext);

export const getStoredLanguage = (): SupportedLanguage => {
    if (typeof window === 'undefined') return 'en';
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as SupportedLanguage | null;
    if (stored && LANGUAGES.some((l) => l.code === stored)) return stored;
    return 'en';
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<SupportedLanguage>('en');

    useEffect(() => {
        try {
            const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as SupportedLanguage | null;
            if (stored && LANGUAGES.some((l) => l.code === stored)) {
                setLanguageState(stored);
            }
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const map: Record<SupportedLanguage, string> = { en: 'en', es: 'es', pl: 'pl' };
        document.documentElement.lang = map[language];
    }, [language]);

    const setLanguage = useCallback((lang: SupportedLanguage) => {
        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
        } catch {
            /* ignore */
        }
        setLanguageState(lang);
    }, []);

    const meta = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

    const t = useCallback((text: string) => uiTranslate(language, text), [language]);

    return (
        <LanguageContext.Provider
            value={{
                language,
                setLanguage,
                languageLabel: meta.label,
                languageCode: meta.code.toUpperCase(),
                t,
            }}
        >
            {children}
        </LanguageContext.Provider>
    );
};
