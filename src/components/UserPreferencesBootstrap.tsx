'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage, type SupportedLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { preferencesService } from '@/services/dashboardService';
import { acThemeToUiMode, type AcThemeMode } from '@/lib/applyAcTheme';

/** Load saved theme/language from the server when a user signs in. */
export function UserPreferencesBootstrap() {
    const { user } = useAuth();
    const { setLanguage } = useLanguage();
    const { setThemeMode } = useTheme();

    useEffect(() => {
        if (!user?.id) return;

        let cancelled = false;

        (async () => {
            const { preferences } = await preferencesService.getPreferences(user.id);
            if (cancelled || !preferences) return;

            const serverLang = preferences.dashboard_layout?.ui_language;
            if (typeof serverLang === 'string' && ['en', 'es', 'pl'].includes(serverLang)) {
                setLanguage(serverLang as SupportedLanguage, { skipServer: true });
            }

            const serverTheme = preferences.theme as AcThemeMode | undefined;
            if (serverTheme && ['light', 'dark', 'auto'].includes(serverTheme)) {
                setThemeMode(acThemeToUiMode(serverTheme), { skipServer: true });
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [user?.id, setLanguage, setThemeMode]);

    return null;
}
