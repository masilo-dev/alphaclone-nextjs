'use client';

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { isPublicMarketingRoute } from '@/lib/isPublicMarketingRoute';
import { useAuth } from '@/contexts/AuthContext';
import { preferencesService } from '@/services/dashboardService';
import {
    applyAcThemeClass,
    persistAcTheme,
    readStoredAcTheme,
    acThemeToUiMode,
    uiModeToAcTheme,
    type AcThemeMode,
} from '@/lib/applyAcTheme';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextType {
    backgroundColor: string;
    setBackgroundColor: (color: string) => void;
    resetToDefault: () => void;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode, opts?: { skipServer?: boolean }) => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

interface ThemeProviderProps {
    children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const { user } = useAuth();
    const forceLight = isPublicMarketingRoute(usePathname());
    const userId = user?.id ?? null;

    const [backgroundColor, setBackgroundColor] = useState('var(--ws-canvas)');
    const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
    const [isDark, setIsDark] = useState(true);

    const applyMode = useCallback((mode: ThemeMode) => {
        const acMode = forceLight ? 'light' : uiModeToAcTheme(mode);
        applyAcThemeClass(acMode);
        setIsDark(resolveIsDark(acMode));
    }, [forceLight]);

    useLayoutEffect(() => {
        const savedColor = localStorage.getItem('dashboard-bg-color');
        if (savedColor) {
            setBackgroundColor(savedColor);
            document.documentElement.style.setProperty('--dashboard-bg', savedColor);
        }

        const acTheme = readStoredAcTheme(userId);
        const uiMode = acThemeToUiMode(acTheme);
        setThemeModeState(uiMode);
        applyMode(uiMode);
    }, [userId, applyMode]);

    useEffect(() => {
        const onThemeChanged = () => {
            const acTheme = readStoredAcTheme(userId);
            const uiMode = acThemeToUiMode(acTheme);
            setThemeModeState(uiMode);
            setIsDark(forceLight ? false : resolveIsDark(acTheme));
        };
        window.addEventListener('ac-theme-changed', onThemeChanged);
        return () => window.removeEventListener('ac-theme-changed', onThemeChanged);
    }, [userId, forceLight]);

    useEffect(() => {
        const acMode = uiModeToAcTheme(themeMode);
        if (forceLight || acMode !== 'auto') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            setIsDark(mediaQuery.matches);
            applyAcThemeClass('auto');
        };
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [themeMode, forceLight]);

    const handleSetBackgroundColor = (color: string) => {
        setBackgroundColor(color);
        localStorage.setItem('dashboard-bg-color', color);
        document.documentElement.style.setProperty('--dashboard-bg', color);
    };

    const handleSetThemeMode = useCallback(
        (mode: ThemeMode, opts?: { skipServer?: boolean }) => {
            const acMode = uiModeToAcTheme(mode);
            setThemeModeState(mode);
            persistAcTheme(acMode, userId);
            applyMode(mode);

            if (userId && !opts?.skipServer) {
                void preferencesService.updateTheme(userId, acMode);
            }
        },
        [userId, applyMode],
    );

    const resetToDefault = () => {
        handleSetBackgroundColor('var(--ws-canvas)');
        handleSetThemeMode('dark');
    };

    return (
        <ThemeContext.Provider
            value={{
                backgroundColor,
                setBackgroundColor: handleSetBackgroundColor,
                resetToDefault,
                themeMode: forceLight ? 'light' : themeMode,
                setThemeMode: handleSetThemeMode,
                isDark: forceLight ? false : isDark,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
};

function resolveIsDark(t: AcThemeMode): boolean {
    if (typeof window === 'undefined') return t !== 'light';
    if (t === 'auto') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return t === 'dark';
}
