/** Single place for dashboard light/dark class on <html> (Settings, Sidebar, ThemeToggle, Providers). */

export type AcThemeMode = 'light' | 'dark' | 'auto';

export function applyAcThemeClass(t: AcThemeMode): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (t === 'auto') {
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', dark);
        root.classList.toggle('light', !dark);
    } else {
        root.classList.toggle('dark', t === 'dark');
        root.classList.toggle('light', t === 'light');
    }
    try {
        window.dispatchEvent(new CustomEvent('ac-theme-changed', { detail: { mode: t } }));
    } catch {
        /* ignore */
    }
}

export function persistAcTheme(t: AcThemeMode): void {
    try {
        localStorage.setItem('ac-theme', t);
    } catch {
        /* ignore */
    }
}

export function readStoredAcTheme(): AcThemeMode {
    try {
        const saved = localStorage.getItem('ac-theme') as AcThemeMode | null;
        if (saved && ['light', 'dark', 'auto'].includes(saved)) return saved;
    } catch {
        /* ignore */
    }
    return 'dark';
}
