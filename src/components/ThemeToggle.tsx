import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { preferencesService } from '../services/dashboardService';
import type { AcThemeMode } from '../lib/applyAcTheme';
import { applyAcThemeClass, persistAcTheme, readStoredAcTheme } from '../lib/applyAcTheme';

interface ThemeToggleProps {
    userId: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ userId }) => {
    const [theme, setTheme] = useState<AcThemeMode>('dark');

    const loadTheme = async () => {
        const stored = readStoredAcTheme(userId);
        applyAcThemeClass(stored);
        setTheme(stored);
        const { preferences } = await preferencesService.getPreferences(userId);
        const serverTheme = preferences?.theme as AcThemeMode | undefined;
        if (serverTheme && ['light', 'dark', 'auto'].includes(serverTheme)) {
            setTheme(serverTheme);
            persistAcTheme(serverTheme, userId);
            applyAcThemeClass(serverTheme);
        }
    };

    useEffect(() => {
        loadTheme();
    }, [userId]);

    useEffect(() => {
        const onRemote = () => setTheme(readStoredAcTheme(userId));
        window.addEventListener('ac-theme-changed', onRemote);
        return () => window.removeEventListener('ac-theme-changed', onRemote);
    }, [userId]);

    const handleThemeChange = async (newTheme: AcThemeMode) => {
        setTheme(newTheme);
        persistAcTheme(newTheme, userId);
        applyAcThemeClass(newTheme);
        await preferencesService.updateTheme(userId, newTheme);
    };

    return (
        <div className="flex items-center gap-1 bg-[var(--surface-secondary)] border border-[var(--border-default)] rounded-lg p-1 transition-colors">
            <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`p-2 rounded-md transition-all ${
                    theme === 'light'
                        ? 'bg-[var(--surface-elevated)] shadow-sm text-amber-500 font-medium'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }`}
                title="Light mode"
                aria-label="Light mode"
            >
                <Sun className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`p-2 rounded-md transition-all ${
                    theme === 'dark'
                        ? 'bg-[var(--surface-elevated)] shadow-sm text-[var(--interactive-secondary,#4199A4)] font-medium'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }`}
                title="Dark mode"
                aria-label="Dark mode"
            >
                <Moon className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => handleThemeChange('auto')}
                className={`p-2 rounded-md transition-all ${
                    theme === 'auto'
                        ? 'bg-[var(--surface-elevated)] shadow-sm text-[var(--interactive-secondary,#4199A4)] font-medium'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }`}
                title="Auto (system)"
                aria-label="Auto (system)"
            >
                <Monitor className="w-4 h-4" />
            </button>
        </div>
    );
};

export default ThemeToggle;
