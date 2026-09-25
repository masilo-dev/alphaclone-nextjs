'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LANGUAGES, LANGUAGE_STORAGE_KEY, type SupportedLanguage } from '@/i18n/languages';
import { uiTranslate } from '@/i18n/uiTranslate';
import { readUserPrefKey, writeUserPrefKey } from '@/lib/scopedUserPrefs';
import { preferencesService } from '@/services/dashboardService';

export type { SupportedLanguage };
export { LANGUAGES, LANGUAGE_STORAGE_KEY };

interface LanguageContextType {
    language: SupportedLanguage;
    setLanguage: (lang: SupportedLanguage, opts?: { skipServer?: boolean }) => void;
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

export const getStoredLanguage = (userId?: string | null): SupportedLanguage => {
    if (typeof window === 'undefined') return 'en';

    // 1. Check scoped/unscoped localStorage
    const stored = readUserPrefKey(LANGUAGE_STORAGE_KEY, userId) as SupportedLanguage | null;
    if (stored && LANGUAGES.some((l) => l.code === stored)) return stored;

    // 2. Check cookie
    try {
        const match = document.cookie.match(/(?:^|;\s*)ac-language=([^;]+)/);
        if (match && match[1]) {
            const cookieLang = decodeURIComponent(match[1]) as SupportedLanguage;
            if (LANGUAGES.some((l) => l.code === cookieLang)) return cookieLang;
        }
    } catch {
        /* ignore */
    }

    // 3. Check html tag if already set by inline script
    try {
        const htmlLang = document.documentElement.lang as SupportedLanguage;
        if (htmlLang && LANGUAGES.some((l) => l.code === htmlLang)) return htmlLang;
    } catch {
        /* ignore */
    }

    return 'en';
};

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
    return typeof value === 'string' && LANGUAGES.some((l) => l.code === value);
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const userId = user?.id ?? null;

    // Synchronous initial value to eliminate English-to-Polish / English-to-Spanish flash on load
    const [language, setLanguageState] = useState<SupportedLanguage>(() => {
        if (typeof window !== 'undefined') {
            return getStoredLanguage(null);
        }
        return 'en';
    });

    useEffect(() => {
        const stored = getStoredLanguage(userId);
        setLanguageState(stored);
        if (typeof document !== 'undefined') {
            document.documentElement.lang = stored;
        }
    }, [userId]);

    useEffect(() => {
        const onLanguageChanged = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (isSupportedLanguage(detail?.language)) {
                setLanguageState(detail.language);
                if (typeof document !== 'undefined') {
                    document.documentElement.lang = detail.language;
                }
            }
        };
        window.addEventListener('ac-language-changed', onLanguageChanged);
        return () => window.removeEventListener('ac-language-changed', onLanguageChanged);
    }, []);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.documentElement.lang = language;
    }, [language]);

    const setLanguage = useCallback(
        (lang: SupportedLanguage, opts?: { skipServer?: boolean }) => {
            writeUserPrefKey(LANGUAGE_STORAGE_KEY, lang, userId);
            try {
                document.cookie = `ac-language=${encodeURIComponent(lang)};path=/;max-age=31536000;SameSite=Lax`;
            } catch {
                /* ignore */
            }
            setLanguageState(lang);
            if (typeof document !== 'undefined') {
                document.documentElement.lang = lang;
            }
            try {
                window.dispatchEvent(new CustomEvent('ac-language-changed', { detail: { language: lang } }));
            } catch {
                /* ignore */
            }
            if (userId && !opts?.skipServer) {
                void preferencesService.updateLanguage(userId, lang);
            }
        },
        [userId],
    );

    const meta = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

    const t = useCallback((text: string) => uiTranslate(language, text), [language]);

    const value = useMemo(
        () => ({
            language,
            setLanguage,
            languageLabel: meta.label,
            languageCode: meta.code.toUpperCase(),
            t,
        }),
        [language, setLanguage, meta.label, meta.code, t],
    );

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
