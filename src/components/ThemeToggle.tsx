import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { preferencesService } from '../services/dashboardService';

interface ThemeToggleProps {
    userId: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ userId }) => {
    const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('dark');

    useEffect(() => {
        loadTheme();
    }, [userId]);

    const loadTheme = async () => {
        const { preferences } = await preferencesService.getPreferences(userId);
        if (preferences?.theme) {
            setTheme(preferences.theme);
            applyTheme(preferences.theme);
        }
    };

    const applyTheme = (newTheme: 'light' | 'dark' | 'auto') => {
        const root = document.documentElement;

        if (newTheme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.toggle('dark', prefersDark);
            root.classList.toggle('light', !prefersDark);
        } else {
            root.classList.toggle('dark', newTheme === 'dark');
            root.classList.toggle('light', newTheme === 'light');
        }
    };

    const handleThemeChange = async (newTheme: 'light' | 'dark' | 'auto') => {
        setTheme(newTheme);
        applyTheme(newTheme);
        await preferencesService.updateTheme(userId, newTheme);
    };

    return (
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            <button
                onClick={() => handleThemeChange('light')}
                className={`p-2 rounded-md transition-colors ${theme === 'light'
                        ? 'bg-slate-700 text-yellow-400'
                        : 'text-slate-400 hover:text-white'
                    }`}
                title="Light mode"
            >
                <Sun className="w-4 h-4" />
            </button>
            <button
                onClick={() => handleThemeChange('dark')}
                className={`p-2 rounded-md transition-colors ${theme === 'dark'
                        ? 'bg-slate-700 text-blue-400'
                        : 'text-slate-400 hover:text-white'
                    }`}
                title="Dark mode"
            >
                <Moon className="w-4 h-4" />
            </button>
            <button
                onClick={() => handleThemeChange('auto')}
                className={`p-2 rounded-md transition-colors ${theme === 'auto'
                        ? 'bg-slate-700 text-teal-400'
                        : 'text-slate-400 hover:text-white'
                    }`}
                title="Auto (system)"
            >
                <Monitor className="w-4 h-4" />
            </button>
        </div>
    );
};

export default ThemeToggle;
