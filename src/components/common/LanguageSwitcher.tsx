'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';
import { LANGUAGES, type SupportedLanguage } from '@/i18n/languages';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    const handleChange = (lang: SupportedLanguage) => {
        setLanguage(lang);
        setIsOpen(false);
    };

    const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm transition-colors"
            >
                <Globe className="w-4 h-4" />
                <span className="font-medium">{current.nativeName}</span>
                <span className="text-xs text-slate-500">{current.flag}</span>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => handleChange(lang.code)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                                    language === lang.code
                                        ? 'bg-teal-500/10 text-teal-400'
                                        : 'text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                                <span className="text-base">{lang.flag}</span>
                                <div className="text-left">
                                    <span className="font-medium">{lang.nativeName}</span>
                                    <span className="block text-xs text-slate-500">{lang.label}</span>
                                </div>
                                {language === lang.code && (
                                    <span className="ml-auto w-2 h-2 rounded-full bg-teal-400" />
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
