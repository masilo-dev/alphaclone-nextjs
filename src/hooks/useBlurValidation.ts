'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Debounced field validation shown only after blur (enterprise form pattern).
 */
export function useBlurValidation<T>(
  value: T,
  validate: (value: T) => string | undefined,
  debounceMs = 500
) {
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!touched) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setError(validate(value));
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, validate, debounceMs, touched]);

  const onBlur = useCallback(() => {
    setTouched(true);
    setError(validate(value));
  }, [validate, value]);

  const clear = useCallback(() => {
    setTouched(false);
    setError(undefined);
  }, []);

  return {
    error: touched ? error : undefined,
    onBlur,
    markTouched: () => setTouched(true),
    clear,
  };
}
