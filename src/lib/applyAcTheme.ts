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

/**
 * Detect if the current device is mobile based on screen width
 */
export function isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
}

/**
 * Apply mobile-specific viewport meta tag for proper scaling
 */
export function applyMobileViewport(): void {
    if (typeof document === 'undefined') return;
    const existing = document.querySelector('meta[name="viewport"]');
    if (!existing) {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
        document.head.appendChild(meta);
    }
}

/**
 * Add touch-friendly styles for mobile
 */
export function addMobileStyles(): void {
    if (typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.textContent = `
        @media (max-width: 767px) {
            /* Increase touch targets */
            button, a, input, select, textarea {
                min-height: 44px;
            }
            /* Prevent text selection on interactive elements */
            .no-select {
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                user-select: none;
            }
            /* Safe area padding for notched devices */
            .safe-bottom {
                padding-bottom: env(safe-area-inset-bottom, 16px);
            }
            .safe-top {
                padding-top: env(safe-area-inset-top, 16px);
            }
            /* Prevent zoom on input focus */
            input, select, textarea {
                font-size: 16px !important;
            }
        }
    `;
    document.head.appendChild(style);
}
