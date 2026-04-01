import { SupportedLanguage, getStoredLanguage } from '@/contexts/LanguageContext';

/**
 * Returns an AI prompt instruction suffix that tells the model
 * which language to generate content in.
 * Safe to call from both client and server contexts.
 */
export const getLanguageInstruction = (lang?: SupportedLanguage): string => {
    const resolved = lang ?? getStoredLanguage();
    switch (resolved) {
        case 'es':
            return '\n\nIMPORTANT: Generate ALL content in Spanish (Español). The entire response must be in Spanish — no mixing with other languages.';
        case 'pl':
            return '\n\nIMPORTANT: Generate ALL content in Polish (Polski). The entire response must be in Polish — no mixing with other languages.';
        case 'en':
        default:
            return '\n\nIMPORTANT: Generate ALL content in English. The entire response must be in English.';
    }
};

/**
 * Appends the correct language instruction to any existing prompt.
 * Use this in every AI generation call to honour the user's language setting.
 */
export const withLanguage = (prompt: string, lang?: SupportedLanguage): string => {
    return prompt + getLanguageInstruction(lang);
};

/**
 * Returns the full language name for display or for passing to APIs.
 */
export const getLanguageName = (lang: SupportedLanguage): string => {
    switch (lang) {
        case 'es': return 'Spanish (Español)';
        case 'pl': return 'Polish (Polski)';
        default:   return 'English';
    }
};
