/** Single place for dashboard light/dark class on <html> (Settings, Sidebar, ThemeToggle, Providers). */

import { readUserPrefKey, writeUserPrefKey } from '@/lib/scopedUserPrefs';

export type AcThemeMode = 'light' | 'dark' | 'auto';

export const AC_THEME_STORAGE_KEY = 'ac-theme';

function resolveIsDark(t: AcThemeMode): boolean {
    if (t === 'auto') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return t === 'dark';
}

export function applyAcThemeClass(t: AcThemeMode): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const isDark = resolveIsDark(t);
    root.classList.toggle('dark', isDark);
    root.classList.toggle('light', !isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
    try {
        window.dispatchEvent(new CustomEvent('ac-theme-changed', { detail: { mode: t } }));
    } catch {
        /* ignore */
    }
}

export function persistAcTheme(t: AcThemeMode, userId?: string | null): void {
    writeUserPrefKey(AC_THEME_STORAGE_KEY, t, userId);
    try {
        localStorage.removeItem('theme-mode');
    } catch {
        /* ignore */
    }
}

export function readStoredAcTheme(userId?: string | null): AcThemeMode {
    try {
        const saved = readUserPrefKey(AC_THEME_STORAGE_KEY, userId) as AcThemeMode | null;
        if (saved && ['light', 'dark', 'auto'].includes(saved)) return saved;

        const legacy = localStorage.getItem('theme-mode');
        if (legacy === 'system') return 'auto';
        if (legacy === 'light' || legacy === 'dark') return legacy;
    } catch {
        /* ignore */
    }
    return 'dark';
}

export function acThemeToUiMode(t: AcThemeMode): 'dark' | 'light' | 'system' {
    return t === 'auto' ? 'system' : t;
}

export function uiModeToAcTheme(mode: 'dark' | 'light' | 'system'): AcThemeMode {
    return mode === 'system' ? 'auto' : mode;
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
