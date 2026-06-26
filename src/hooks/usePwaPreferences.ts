'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  readPwaPreferences,
  writePwaPreferences,
  subscribePwaPreferences,
  type PwaPreferences,
} from '@/lib/pwa/pwaPreferences';

export function usePwaPreferences() {
  const [prefs, setPrefs] = useState<PwaPreferences>(() => readPwaPreferences());

  useEffect(() => subscribePwaPreferences(() => setPrefs(readPwaPreferences())), []);

  const updatePrefs = useCallback((patch: Partial<PwaPreferences>) => {
    const next = { ...readPwaPreferences(), ...patch };
    writePwaPreferences(next);
    setPrefs(next);
  }, []);

  return { prefs, updatePrefs };
}
