'use client';

import { useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { LANGUAGES, type SupportedLanguage } from '@/i18n/languages';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LanguageSwitcher() {
    const { language, languageCode, setLanguage, t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    const handleChange = (lang: SupportedLanguage) => {
        setLanguage(lang);
        setIsOpen(false);
    };

    const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

    return (
        <div className="language-switcher relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-label={`${t('Language')}: ${current.nativeName}`}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-default)] text-[var(--text-secondary)] type-caption transition-colors"
            >
                <Globe className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
                <span className="font-semibold">{current.nativeName}</span>
                <span className="rounded bg-[var(--surface-tertiary)] px-1.5 py-0.5 type-caption font-bold tracking-wide text-[var(--text-muted)]">{languageCode}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-[var(--surface-elevated)] border border-[var(--border-default)] rounded-xl shadow-2xl z-50 overflow-hidden" role="listbox" aria-label={t('Language')}>
                        <div className="px-3 py-2 border-b border-[var(--border-default)] type-caption font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            {t('Choose language')}
                        </div>
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                type="button"
                                onClick={() => handleChange(lang.code)}
                                role="option"
                                aria-selected={language === lang.code}
                                className={`w-full flex items-center gap-3 px-4 py-3 type-ui transition-colors ${
                                    language === lang.code
                                        ? 'bg-[var(--brand-blue-500)]/10 text-[var(--brand-blue-400)]'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                                }`}
                            >
                                <div className="text-left">
                                    <span className="font-medium">{lang.nativeName}</span>
                                    <span className="block type-caption text-[var(--text-muted)]">{lang.label} · {lang.code.toUpperCase()}</span>
                                </div>
                                {language === lang.code && (
                                    <Check className="ml-auto w-4 h-4 text-[var(--brand-blue-400)]" aria-hidden="true" />
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
