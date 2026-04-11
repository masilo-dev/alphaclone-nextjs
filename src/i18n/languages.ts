export type SupportedLanguage = 'en' | 'es' | 'pl';

export const LANGUAGES: { code: SupportedLanguage; label: string; flag: string; nativeName: string }[] = [
    { code: 'en', label: 'English', flag: 'GB', nativeName: 'English' },
    { code: 'es', label: 'Spanish', flag: 'ES', nativeName: 'Español' },
    { code: 'pl', label: 'Polish', flag: 'PL', nativeName: 'Polski' },
];

export const LANGUAGE_STORAGE_KEY = 'ac-language';
