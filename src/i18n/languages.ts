import { readUserPrefKey, writeUserPrefKey } from '@/lib/scopedUserPrefs';

export type SupportedLanguage = 'en' | 'es' | 'pl';

export const LANGUAGES: { code: SupportedLanguage; label: string; flag: string; nativeName: string }[] = [
    { code: 'en', label: 'English', flag: 'GB', nativeName: 'English' },
    { code: 'es', label: 'Spanish', flag: 'ES', nativeName: 'Español' },
    { code: 'pl', label: 'Polish', flag: 'PL', nativeName: 'Polski' },
];

export const LANGUAGE_STORAGE_KEY = 'ac-language';

// Translation dictionary
const translations: Record<SupportedLanguage, Record<string, string>> = {
    en: {
        'app.name': 'AlphaClone',
        'app.tagline': 'Business Operating System',
        'nav.home': 'Home',
        'nav.dashboard': 'Dashboard',
        'nav.crm': 'CRM',
        'nav.leads': 'Leads',
        'nav.projects': 'Projects',
        'nav.invoices': 'Invoices',
        'nav.settings': 'Settings',
        'nav.logout': 'Logout',
        'nav.login': 'Login',
        'nav.register': 'Register',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'common.create': 'Create',
        'common.search': 'Search',
        'common.loading': 'Loading...',
        'common.error': 'Error',
        'common.success': 'Success',
        'common.noData': 'No data available',
        'auth.welcome': 'Welcome back',
        'auth.email': 'Email',
        'auth.password': 'Password',
        'auth.signIn': 'Sign In',
        'auth.signUp': 'Sign Up',
        'auth.forgotPassword': 'Forgot Password?',
        'auth.termsAccept': 'I accept the Terms of Service and Privacy Policy',
        'dashboard.title': 'Dashboard',
        'dashboard.totalRevenue': 'Total Revenue',
        'dashboard.activeClients': 'Active Clients',
        'dashboard.pendingInvoices': 'Pending Invoices',
        'dashboard.openDeals': 'Open Deals',
        'crm.title': 'CRM',
        'crm.leads': 'Leads',
        'crm.clients': 'Clients',
        'crm.contacts': 'Contacts',
        'crm.addLead': 'Add Lead',
        'crm.addClient': 'Add Client',
        'crm.qualify': 'Qualify',
        'crm.disqualify': 'Disqualify',
        'crm.markContacted': 'Mark Contacted',
        'community.title': 'Community',
        'community.placeholder': 'Type your message...',
        'community.send': 'Send',
        'community.noMessages': 'No messages yet. Be the first!',
        'settings.language': 'Language',
        'settings.theme': 'Theme',
        'settings.notifications': 'Notifications',
        'settings.privacy': 'Privacy',
        'legal.terms': 'Terms of Service',
        'legal.privacy': 'Privacy Policy',
        'legal.cookies': 'Cookie Policy',
        'legal.security': 'Security Policy',
    },
    es: {
        'app.name': 'AlphaClone',
        'app.tagline': 'Sistema Operativo Empresarial',
        'nav.home': 'Inicio',
        'nav.dashboard': 'Panel',
        'nav.crm': 'CRM',
        'nav.leads': 'Clientes Potenciales',
        'nav.projects': 'Proyectos',
        'nav.invoices': 'Facturas',
        'nav.settings': 'Configuración',
        'nav.logout': 'Cerrar Sesión',
        'nav.login': 'Iniciar Sesión',
        'nav.register': 'Registrarse',
        'common.save': 'Guardar',
        'common.cancel': 'Cancelar',
        'common.delete': 'Eliminar',
        'common.edit': 'Editar',
        'common.create': 'Crear',
        'common.search': 'Buscar',
        'common.loading': 'Cargando...',
        'common.error': 'Error',
        'common.success': 'Éxito',
        'common.noData': 'No hay datos disponibles',
        'auth.welcome': 'Bienvenido de nuevo',
        'auth.email': 'Correo Electrónico',
        'auth.password': 'Contraseña',
        'auth.signIn': 'Iniciar Sesión',
        'auth.signUp': 'Registrarse',
        'auth.forgotPassword': '¿Olvidaste tu Contraseña?',
        'auth.termsAccept': 'Acepto los Términos de Servicio y la Política de Privacidad',
        'dashboard.title': 'Panel',
        'dashboard.totalRevenue': 'Ingresos Totales',
        'dashboard.activeClients': 'Clientes Activos',
        'dashboard.pendingInvoices': 'Facturas Pendientes',
        'dashboard.openDeals': 'Ofertas Abiertas',
        'crm.title': 'CRM',
        'crm.leads': 'Clientes Potenciales',
        'crm.clients': 'Clientes',
        'crm.contacts': 'Contactos',
        'crm.addLead': 'Agregar Prospecto',
        'crm.addClient': 'Agregar Cliente',
        'crm.qualify': 'Calificar',
        'crm.disqualify': 'Descalificar',
        'crm.markContacted': 'Marcar Contactado',
        'community.title': 'Comunidad',
        'community.placeholder': 'Escribe tu mensaje...',
        'community.send': 'Enviar',
        'community.noMessages': 'No hay mensajes aún. ¡Sé el primero!',
        'settings.language': 'Idioma',
        'settings.theme': 'Tema',
        'settings.notifications': 'Notificaciones',
        'settings.privacy': 'Privacidad',
        'legal.terms': 'Términos de Servicio',
        'legal.privacy': 'Política de Privacidad',
        'legal.cookies': 'Política de Cookies',
        'legal.security': 'Política de Seguridad',
    },
    pl: {
        'app.name': 'AlphaClone',
        'app.tagline': 'System Operacyjny Biznesu',
        'nav.home': 'Strona Główna',
        'nav.dashboard': 'Panel',
        'nav.crm': 'CRM',
        'nav.leads': 'Lead\'y',
        'nav.projects': 'Projekty',
        'nav.invoices': 'Faktury',
        'nav.settings': 'Ustawienia',
        'nav.logout': 'Wyloguj',
        'nav.login': 'Zaloguj',
        'nav.register': 'Rejestracja',
        'common.save': 'Zapisz',
        'common.cancel': 'Anuluj',
        'common.delete': 'Usuń',
        'common.edit': 'Edytuj',
        'common.create': 'Utwórz',
        'common.search': 'Szukaj',
        'common.loading': 'Ładowanie...',
        'common.error': 'Błąd',
        'common.success': 'Sukces',
        'common.noData': 'Brak danych',
        'auth.welcome': 'Witaj ponownie',
        'auth.email': 'Email',
        'auth.password': 'Hasło',
        'auth.signIn': 'Zaloguj się',
        'auth.signUp': 'Zarejestruj się',
        'auth.forgotPassword': 'Zapomniałeś hasła?',
        'auth.termsAccept': 'Akceptuję Warunki Korzystania z Usługi i Politykę Prywatności',
        'dashboard.title': 'Panel',
        'dashboard.totalRevenue': 'Całkowity Przychód',
        'dashboard.activeClients': 'Aktywni Klienci',
        'dashboard.pendingInvoices': 'Oczekujące Faktury',
        'dashboard.openDeals': 'Otwarte Transakcje',
        'crm.title': 'CRM',
        'crm.leads': 'Lead\'y',
        'crm.clients': 'Klienci',
        'crm.contacts': 'Kontakty',
        'crm.addLead': 'Dodaj Lead',
        'crm.addClient': 'Dodaj Klienta',
        'crm.qualify': 'Kwalifikuj',
        'crm.disqualify': 'Dyskwalifikuj',
        'crm.markContacted': 'Oznacz jako Skontaktowany',
        'community.title': 'Społeczność',
        'community.placeholder': 'Napisz wiadomość...',
        'community.send': 'Wyślij',
        'community.noMessages': 'Brak wiadomości. Bądź pierwszy!',
        'settings.language': 'Język',
        'settings.theme': 'Motyw',
        'settings.notifications': 'Powiadomienia',
        'settings.privacy': 'Prywatność',
        'legal.terms': 'Warunki Korzystania z Usługi',
        'legal.privacy': 'Polityka Prywatności',
        'legal.cookies': 'Polityka Cookies',
        'legal.security': 'Polityka Bezpieczeństwa',
    },
};

// Get current language from localStorage (optional user scope for multi-account browsers)
export function getCurrentLanguage(userId?: string | null): SupportedLanguage {
    if (typeof window === 'undefined') return 'en';
    try {
        const saved = readUserPrefKey(LANGUAGE_STORAGE_KEY, userId) as SupportedLanguage | null;
        if (saved && ['en', 'es', 'pl'].includes(saved)) return saved;
    } catch {
        /* ignore */
    }
    return 'en';
}

// Set language and persist
export function setLanguage(lang: SupportedLanguage, userId?: string | null): void {
    if (typeof window === 'undefined') return;
    try {
        writeUserPrefKey(LANGUAGE_STORAGE_KEY, lang, userId);
        document.documentElement.setAttribute('lang', lang);
        window.dispatchEvent(new CustomEvent('ac-language-changed', { detail: { language: lang } }));
    } catch {
        /* ignore */
    }
}

// Translate a key
export function t(key: string, lang?: SupportedLanguage): string {
    const currentLang = lang || getCurrentLanguage();
    const dict = translations[currentLang];
    if (dict && dict[key]) {
        return dict[key];
    }
    // Fallback to English
    const enDict = translations['en'];
    if (enDict && enDict[key]) {
        return enDict[key];
    }
    // Return the key itself if not found
    return key;
}

// Subscribe to language changes
export function onLanguageChange(callback: (lang: SupportedLanguage) => void): () => void {
    const handler = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.language) {
            callback(detail.language);
        }
    };
    if (typeof window !== 'undefined') {
        window.addEventListener('ac-language-changed', handler);
    }
    return () => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('ac-language-changed', handler);
        }
    };
}
