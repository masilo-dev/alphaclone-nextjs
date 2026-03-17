import { useRef, useEffect, useCallback } from 'react';

/**
 * Create a stable callback that doesn't change on every render
 * Prevents unnecessary re-renders and useEffect triggers
 * 
 * Usage:
 * const stableCallback = useStableCallback(() => {
 *   // Your callback logic
 * });
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: any[]) => {
    return callbackRef.current(...args);
  }, []) as T;
}

/**
 * Like useMemo but guarantees stable reference until dependencies actually change
 * Prevents infinite loops from object recreation
 */
export function useStableMemo<T>(factory: () => T, deps: React.DependencyList): T {
  const ref = useRef<{ value: T; deps: React.DependencyList } | undefined>(undefined);

  if (!ref.current || !shallowEqual(ref.current.deps, deps)) {
    ref.current = {
      value: factory(),
      deps,
    };
  }

  return ref.current.value;
}

function shallowEqual(arr1: React.DependencyList | undefined, arr2: React.DependencyList | undefined): boolean {
  if (!arr1 && !arr2) return true;
  if (!arr1 || !arr2) return false;
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}




