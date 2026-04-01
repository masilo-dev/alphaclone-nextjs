'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ── Supported languages ────────────────────────────────────────────────────
export type SupportedLanguage = 'en' | 'es' | 'pl';

export const LANGUAGES: { code: SupportedLanguage; label: string; flag: string; nativeName: string }[] = [
    { code: 'en', label: 'English',  flag: '🇬🇧', nativeName: 'English' },
    { code: 'es', label: 'Spanish',  flag: '🇪🇸', nativeName: 'Español' },
    { code: 'pl', label: 'Polish',   flag: '🇵🇱', nativeName: 'Polski'  },
];

export const LANGUAGE_STORAGE_KEY = 'ac-language';

// ── Context shape ──────────────────────────────────────────────────────────
interface LanguageContextType {
    language: SupportedLanguage;
    setLanguage: (lang: SupportedLanguage) => void;
    languageLabel: string;
    languageFlag: string;
}

// Safe default so the hook never crashes even outside the provider
const LanguageContext = createContext<LanguageContextType>({
    language: 'en',
    setLanguage: () => {},
    languageLabel: 'English',
    languageFlag: '🇬🇧',
});

// ── Hook ───────────────────────────────────────────────────────────────────
export const useLanguage = (): LanguageContextType => useContext(LanguageContext);

// ── Helper: read language synchronously from localStorage (for services) ──
export const getStoredLanguage = (): SupportedLanguage => {
    if (typeof window === 'undefined') return 'en';
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as SupportedLanguage | null;
    if (stored && LANGUAGES.some(l => l.code === stored)) return stored;
    return 'en';
};

// ── Provider ───────────────────────────────────────────────────────────────
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<SupportedLanguage>('en');

    // Load from localStorage on mount (client-only)
    useEffect(() => {
        try {
            const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as SupportedLanguage | null;
            if (stored && LANGUAGES.some(l => l.code === stored)) {
                setLanguageState(stored);
            }
        } catch {
            // localStorage not available — silently keep default
        }
    }, []);

    const setLanguage = useCallback((lang: SupportedLanguage) => {
        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
        } catch {
            // Ignore storage errors
        }
        setLanguageState(lang);
    }, []);

    const meta = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0];

    return (
        <LanguageContext.Provider value={{
            language,
            setLanguage,
            languageLabel: meta.label,
            languageFlag: meta.flag,
        }}>
            {children}
        </LanguageContext.Provider>
    );
};
