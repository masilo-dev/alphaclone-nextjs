'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_PREFS,
  readPwaPreferences,
  writePwaPreferences,
  subscribePwaPreferences,
  type PwaPreferences,
} from '@/lib/pwa/pwaPreferences';

export function usePwaPreferences() {
  const [prefs, setPrefs] = useState<PwaPreferences>(() => ({ ...DEFAULT_PREFS, categories: { ...DEFAULT_PREFS.categories }, bottomNavModuleIds: [...DEFAULT_PREFS.bottomNavModuleIds] }));

  useEffect(() => {
    setPrefs(readPwaPreferences());
    return subscribePwaPreferences(() => setPrefs(readPwaPreferences()));
  }, []);

  const updatePrefs = useCallback((patch: Partial<PwaPreferences>) => {
    const next = { ...readPwaPreferences(), ...patch };
    writePwaPreferences(next);
    setPrefs(next);
  }, []);

  return { prefs, updatePrefs };
}
