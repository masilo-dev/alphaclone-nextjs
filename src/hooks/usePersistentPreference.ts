'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Stores small, per-workspace UI choices locally. This keeps users in the
 * view they chose without delaying the page for a server preference request.
 * Prevents re-render cascades and React error #185 by isolating validators in refs
 * and syncing with localStorage without feedback loops.
 */
export function usePersistentPreference<T extends string>(
  key: string | null,
  fallback: T,
  isValid: (value: unknown) => value is T,
) {
  const isValidRef = useRef(isValid);
  isValidRef.current = isValid;

  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  const [value, setValueState] = useState<T>(fallback);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Sync from localStorage on mount or whenever the key changes
  useEffect(() => {
    if (!key || typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored && isValidRef.current(stored)) {
        if (stored !== valueRef.current) {
          setValueState(stored);
        }
      } else if (valueRef.current !== fallbackRef.current) {
        setValueState(fallbackRef.current);
      }
    } catch {
      // localStorage may fail in restricted sandboxes
    }
  }, [key]);

  // Setter that updates state AND synchronizes localStorage atomically
  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
        if (resolved === prev) return prev;
        if (key && typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, resolved);
          } catch {
            // ignore localStorage quota or privacy errors
          }
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, setValue] as const;
}

