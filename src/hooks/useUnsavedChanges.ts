'use client';

import { useEffect, useCallback } from 'react';

/**
 * Hook to guard against accidental navigation or window closing when a form has unsaved modifications.
 */
export function useUnsavedChanges(isDirty: boolean, message: string = 'You have unsaved changes. Are you sure you want to leave?') {
  // Guard window/tab close or reload
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, message]);

  const confirmNavigation = useCallback((): boolean => {
    if (!isDirty) return true;
    return window.confirm(message);
  }, [isDirty, message]);

  return { confirmNavigation };
}
