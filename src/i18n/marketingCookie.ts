import type { SupportedLanguage } from './languages';

const pl: Record<string, string> = {
  'Your privacy choices': 'Twoje wybory dotyczące prywatności',
  'We use essential cookies to keep AlphaClone secure. You can allow optional functional, analytics, and marketing cookies, or choose essential only.': 'Używamy niezbędnych plików cookie, aby zapewnić bezpieczeństwo AlphaClone. Możesz zezwolić na opcjonalne pliki funkcjonalne, analityczne i marketingowe albo wybrać tylko niezbędne.',
  'Read the Cookie Policy': 'Przeczytaj politykę plików cookie',
  'Essential only': 'Tylko niezbędne',
  Manage: 'Zarządzaj',
  'Accept all': 'Akceptuj wszystkie',
  'Privacy & Cookie Preferences': 'Preferencje prywatności i plików cookie',
  'Choose which optional cookies AlphaClone may use.': 'Wybierz, których opcjonalnych plików cookie może używać AlphaClone.',
  'Close preferences': 'Zamknij preferencje',
  'Essential Cookies': 'Niezbędne pliki cookie',
  'Required for secure authentication, workspace session state, and security features.': 'Wymagane do bezpiecznego logowania, utrzymania sesji i działania zabezpieczeń.',
  'Functional Cookies': 'Funkcjonalne pliki cookie',
  'Saves layout preferences, theme settings, and language.': 'Zapisują preferencje układu, motyw i język.',
  'Analytics & Insights': 'Analityka i statystyki',
  'Helps us understand platform usage to improve performance and reliability.': 'Pomagają nam zrozumieć sposób korzystania z platformy, aby poprawiać jej wydajność i niezawodność.',
  'Marketing Cookies': 'Marketingowe pliki cookie',
  'Allows campaign measurement and relevant advertising where enabled.': 'Umożliwiają pomiar kampanii i wyświetlanie odpowiednich reklam, jeśli są włączone.',
  'Save preferences': 'Zapisz preferencje',
  On: 'Włączone',
  Off: 'Wyłączone',
};

const es: Record<string, string> = {
  'Your privacy choices': 'Tus opciones de privacidad',
  'We use essential cookies to keep AlphaClone secure. You can allow optional functional, analytics, and marketing cookies, or choose essential only.': 'Usamos cookies esenciales para mantener seguro AlphaClone. Puedes permitir cookies funcionales, analíticas y de marketing opcionales, o elegir solo las esenciales.',
  'Read the Cookie Policy': 'Leer la política de cookies',
  'Essential only': 'Solo esenciales',
  Manage: 'Configurar',
  'Accept all': 'Aceptar todas',
  'Privacy & Cookie Preferences': 'Preferencias de privacidad y cookies',
  'Choose which optional cookies AlphaClone may use.': 'Elige qué cookies opcionales puede usar AlphaClone.',
  'Close preferences': 'Cerrar preferencias',
  'Essential Cookies': 'Cookies esenciales',
  'Required for secure authentication, workspace session state, and security features.': 'Necesarias para la autenticación segura, la sesión del espacio de trabajo y las funciones de seguridad.',
  'Functional Cookies': 'Cookies funcionales',
  'Saves layout preferences, theme settings, and language.': 'Guardan las preferencias de diseño, el tema y el idioma.',
  'Analytics & Insights': 'Análisis y estadísticas',
  'Helps us understand platform usage to improve performance and reliability.': 'Nos ayudan a entender el uso de la plataforma para mejorar su rendimiento y fiabilidad.',
  'Marketing Cookies': 'Cookies de marketing',
  'Allows campaign measurement and relevant advertising where enabled.': 'Permiten medir campañas y mostrar publicidad relevante cuando está habilitada.',
  'Save preferences': 'Guardar preferencias',
  On: 'Activado',
  Off: 'Desactivado',
};

export function marketingCookieTranslate(lang: SupportedLanguage, text: string): string | undefined {
  return lang === 'pl' ? pl[text] : lang === 'es' ? es[text] : undefined;
}
