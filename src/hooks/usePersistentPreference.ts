'use client';

import { useEffect, useState } from 'react';

/**
 * Stores small, per-workspace UI choices locally. This keeps users in the
 * view they chose without delaying the page for a server preference request.
 */
export function usePersistentPreference<T extends string>(
  key: string | null,
  fallback: T,
  isValid: (value: unknown) => value is T,
) {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    if (!key || typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(key);
    if (stored && isValid(stored)) setValue(stored);
    else setValue(fallback);
  }, [key, fallback, isValid]);

  useEffect(() => {
    if (!key || typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
