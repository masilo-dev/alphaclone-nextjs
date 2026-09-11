import { LANGUAGE_STORAGE_KEY, LANGUAGES, type SupportedLanguage } from '@/i18n/languages';

export type CampaignLanguageCode = 'en' | 'es' | 'pl' | 'fr' | 'de' | 'it' | 'pt' | 'nl';
export type CampaignLanguageMode = 'auto' | 'ask' | CampaignLanguageCode;

export const CAMPAIGN_LANGUAGE_OPTIONS: Array<{ code: CampaignLanguageMode; label: string }> = [
    { code: 'auto', label: 'Auto by country/company' },
    { code: 'ask', label: 'Ask before sending' },
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Spanish' },
    { code: 'pl', label: 'Polish' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'it', label: 'Italian' },
    { code: 'pt', label: 'Portuguese' },
    { code: 'nl', label: 'Dutch' },
];

const CAMPAIGN_LANGUAGE_NAMES: Record<CampaignLanguageCode, string> = {
    en: 'English',
    es: 'Spanish',
    pl: 'Polish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    nl: 'Dutch',
};

const COUNTRY_LANGUAGE_MAP: Record<string, CampaignLanguageCode> = {
    US: 'en',
    GB: 'en',
    IE: 'en',
    CA: 'en',
    AU: 'en',
    NZ: 'en',
    ES: 'es',
    MX: 'es',
    CO: 'es',
    AR: 'es',
    CL: 'es',
    PE: 'es',
    PL: 'pl',
    FR: 'fr',
    BE: 'fr',
    CH: 'de',
    DE: 'de',
    AT: 'de',
    IT: 'it',
    PT: 'pt',
    BR: 'pt',
    NL: 'nl',
};

function getStoredLanguage(): SupportedLanguage {
    if (typeof window === 'undefined') return 'en';
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) as SupportedLanguage | null;
    if (stored && LANGUAGES.some((language) => language.code === stored)) return stored;
    return 'en';
}

function normalizeCampaignLanguage(value: unknown): CampaignLanguageMode {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'auto' || raw === 'ask') return raw;
    if (raw in CAMPAIGN_LANGUAGE_NAMES) return raw as CampaignLanguageCode;
    return 'auto';
}

export function inferCampaignLanguageFromContext(context?: {
    countryCode?: unknown;
    country?: unknown;
    address?: unknown;
    company?: unknown;
}): CampaignLanguageCode {
    const countryCode = String(context?.countryCode || '').trim().toUpperCase();
    if (countryCode && COUNTRY_LANGUAGE_MAP[countryCode]) return COUNTRY_LANGUAGE_MAP[countryCode];

    const searchable = [context?.country, context?.address, context?.company]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

    if (/\b(spain|méxico|mexico|colombia|argentina|chile|peru|perú)\b/.test(searchable)) return 'es';
    if (/\b(poland|polska)\b/.test(searchable)) return 'pl';
    if (/\b(france|belgium|belgique|suisse romande)\b/.test(searchable)) return 'fr';
    if (/\b(germany|deutschland|austria|österreich|switzerland|schweiz|suisse)\b/.test(searchable)) return 'de';
    if (/\b(italy|italia)\b/.test(searchable)) return 'it';
    if (/\b(portugal|brazil|brasil)\b/.test(searchable)) return 'pt';
    if (/\b(netherlands|nederland|holland)\b/.test(searchable)) return 'nl';
    return 'en';
}

export function resolveCampaignLanguage(input?: {
    languageMode?: unknown;
    language?: unknown;
    countryCode?: unknown;
    country?: unknown;
    address?: unknown;
    company?: unknown;
}): { mode: CampaignLanguageMode; code: CampaignLanguageCode; label: string; mustAsk: boolean } {
    const mode = normalizeCampaignLanguage(input?.languageMode ?? input?.language);
    const code = mode === 'auto' || mode === 'ask'
        ? inferCampaignLanguageFromContext(input)
        : mode;
    return {
        mode,
        code,
        label: CAMPAIGN_LANGUAGE_NAMES[code],
        mustAsk: mode === 'ask',
    };
}

export function getCampaignLanguageInstruction(input?: {
    languageMode?: unknown;
    language?: unknown;
    countryCode?: unknown;
    country?: unknown;
    address?: unknown;
    company?: unknown;
}): string {
    const resolved = resolveCampaignLanguage(input);
    if (resolved.mustAsk) {
        return '\n\nLANGUAGE POLICY: Ask the user which language to use before generating or sending. Do not guess.';
    }
    return `\n\nLANGUAGE POLICY: Write the complete email in ${resolved.label}. Do not mix languages unless the recipient/company name requires it.`;
}

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
