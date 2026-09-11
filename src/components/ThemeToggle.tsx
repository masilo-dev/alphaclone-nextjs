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
            applyAcThemeClass(serverTheme);
            persistAcTheme(serverTheme, userId);
        }
    };

    useEffect(() => {
        loadTheme();
    }, [userId]);

    useEffect(() => {
        const onRemote = () => setTheme(readStoredAcTheme(userId));
        window.addEventListener('ac-theme-changed', onRemote);
        return () => window.removeEventListener('ac-theme-changed', onRemote);
    }, []);

    const handleThemeChange = async (newTheme: AcThemeMode) => {
        setTheme(newTheme);
        applyAcThemeClass(newTheme);
        persistAcTheme(newTheme, userId);
        await preferencesService.updateTheme(userId, newTheme);
    };

    return (
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            <button
                onClick={() => handleThemeChange('light')}
                className={`p-2 rounded-md transition-colors ${theme === 'light'
                        ? 'bg-slate-700 text-yellow-400'
                        : 'text-slate-400 hover:text-white'
                    } `}
                title="Light mode"
            >
                <Sun className="w-4 h-4" />
            </button>
            <button
                onClick={() => handleThemeChange('dark')}
                className={`p-2 rounded-md transition-colors ${theme === 'dark'
                        ? 'bg-slate-700 text-blue-400'
                        : 'text-slate-400 hover:text-white'
                    } `}
                title="Dark mode"
            >
                <Moon className="w-4 h-4" />
            </button>
            <button
                onClick={() => handleThemeChange('auto')}
                className={`p-2 rounded-md transition-colors ${theme === 'auto'
                        ? 'bg-slate-700 text-teal-400'
                        : 'text-slate-400 hover:text-white'
                    } `}
                title="Auto (system)"
            >
                <Monitor className="w-4 h-4" />
            </button>
        </div>
    );
};

export default ThemeToggle;
