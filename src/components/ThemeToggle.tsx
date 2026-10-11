import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Minimize2, Maximize2 } from 'lucide-react';
import { preferencesService } from '../services/dashboardService';
import type { AcThemeMode } from '../lib/applyAcTheme';
import { applyAcThemeClass, persistAcTheme, readStoredAcTheme } from '../lib/applyAcTheme';
import type { AcDensityMode } from '../lib/applyAcDensity';
import { applyAcDensity, persistAcDensity, readStoredAcDensity } from '../lib/applyAcDensity';

interface ThemeToggleProps {
    userId: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ userId }) => {
    const [theme, setTheme] = useState<AcThemeMode>('dark');
    const [density, setDensity] = useState<AcDensityMode>('compact');

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
        setDensity(readStoredAcDensity());
    }, [userId]);

    useEffect(() => {
        const onRemoteTheme = () => setTheme(readStoredAcTheme(userId));
        const onRemoteDensity = () => setDensity(readStoredAcDensity());
        window.addEventListener('ac-theme-changed', onRemoteTheme);
        window.addEventListener('ac-density-changed', onRemoteDensity);
        return () => {
            window.removeEventListener('ac-theme-changed', onRemoteTheme);
            window.removeEventListener('ac-density-changed', onRemoteDensity);
        };
    }, [userId]);

    const handleThemeChange = async (newTheme: AcThemeMode) => {
        setTheme(newTheme);
        persistAcTheme(newTheme, userId);
        applyAcThemeClass(newTheme);
        await preferencesService.updateTheme(userId, newTheme);
    };

    const handleDensityChange = (newDensity: AcDensityMode) => {
        setDensity(newDensity);
        persistAcDensity(newDensity);
        applyAcDensity(newDensity);
    };

    return (
        <div className="flex items-center gap-0.5 bg-[var(--surface-secondary)] border border-[var(--border-default)] rounded-md p-0.5 transition-colors">
            <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`p-1.5 rounded transition-all ${
                    theme === 'light'
                        ? 'bg-[var(--surface-elevated)] shadow-sm text-amber-500 font-medium'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }`}
                title="Light mode"
                aria-label="Light mode"
            >
                <Sun className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`p-1.5 rounded transition-all ${
                    theme === 'dark'
                        ? 'bg-[var(--surface-elevated)] shadow-sm text-[var(--accent,var(--interactive-secondary))] font-medium'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }`}
                title="Dark mode (charcoal)"
                aria-label="Dark mode"
            >
                <Moon className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={() => handleThemeChange('auto')}
                className={`p-1.5 rounded transition-all ${
                    theme === 'auto'
                        ? 'bg-[var(--surface-elevated)] shadow-sm text-[var(--accent,var(--interactive-secondary))] font-medium'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }`}
                title="Auto (system)"
                aria-label="Auto (system)"
            >
                <Monitor className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-3 bg-[var(--border-default)] mx-0.5" aria-hidden="true" />

            <button
                type="button"
                onClick={() => handleDensityChange('compact')}
                className={`p-1.5 rounded transition-all ${
                    density === 'compact'
                        ? 'bg-[var(--surface-elevated)] shadow-sm text-[var(--accent,var(--interactive-secondary))] font-medium'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }`}
                title="Compact density (default)"
                aria-label="Compact density"
            >
                <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={() => handleDensityChange('comfortable')}
                className={`p-1.5 rounded transition-all ${
                    density === 'comfortable'
                        ? 'bg-[var(--surface-elevated)] shadow-sm text-[var(--accent,var(--interactive-secondary))] font-medium'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }`}
                title="Comfortable density"
                aria-label="Comfortable density"
            >
                <Maximize2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};

export default ThemeToggle;
