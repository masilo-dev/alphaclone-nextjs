'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
    const userId = user?.id ?? null;

    const [backgroundColor, setBackgroundColor] = useState('#0f172a');
    const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
    const [isDark, setIsDark] = useState(true);

    const applyMode = useCallback((mode: ThemeMode) => {
        const acMode = uiModeToAcTheme(mode);
        applyAcThemeClass(acMode);
        setIsDark(resolveIsDark(acMode));
    }, []);

    useEffect(() => {
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
            setIsDark(resolveIsDark(acTheme));
        };
        window.addEventListener('ac-theme-changed', onThemeChanged);
        return () => window.removeEventListener('ac-theme-changed', onThemeChanged);
    }, [userId]);

    useEffect(() => {
        const acMode = uiModeToAcTheme(themeMode);
        if (acMode !== 'auto') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            setIsDark(mediaQuery.matches);
            applyAcThemeClass('auto');
        };
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [themeMode]);

    const handleSetBackgroundColor = (color: string) => {
        setBackgroundColor(color);
        localStorage.setItem('dashboard-bg-color', color);
        document.documentElement.style.setProperty('--dashboard-bg', color);
    };

    const handleSetThemeMode = useCallback(
        (mode: ThemeMode, opts?: { skipServer?: boolean }) => {
            const acMode = uiModeToAcTheme(mode);
            setThemeModeState(mode);
            applyAcThemeClass(acMode);
            persistAcTheme(acMode, userId);
            setIsDark(resolveIsDark(acMode));

            if (userId && !opts?.skipServer) {
                void preferencesService.updateTheme(userId, acMode);
            }
        },
        [userId],
    );

    const resetToDefault = () => {
        handleSetBackgroundColor('#0f172a');
        handleSetThemeMode('dark');
    };

    return (
        <ThemeContext.Provider
            value={{
                backgroundColor,
                setBackgroundColor: handleSetBackgroundColor,
                resetToDefault,
                themeMode,
                setThemeMode: handleSetThemeMode,
                isDark,
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
