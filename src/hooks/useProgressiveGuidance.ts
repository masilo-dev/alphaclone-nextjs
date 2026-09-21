'use client';

import { useEffect, useState } from 'react';
import { useDeviceExperience } from '@/hooks/useDeviceExperience';

const LEARNING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Guidance is useful while a workspace is new, but should not become permanent
 * page furniture. Installed touch PWAs never render it; desktop/browser users
 * get a short learning window for each guide.
 */
export function useProgressiveGuidance(key: string) {
  const { isInstalledMobileCompanion } = useDeviceExperience();
  const [withinLearningWindow, setWithinLearningWindow] = useState(false);

  useEffect(() => {
    if (isInstalledMobileCompanion || typeof window === 'undefined') {
      setWithinLearningWindow(false);
      return;
    }

    const storageKey = `ac_guidance_started:${key}`;
    const stored = Number(window.localStorage.getItem(storageKey));
    const startedAt = Number.isFinite(stored) && stored > 0 ? stored : Date.now();
    if (!stored) window.localStorage.setItem(storageKey, String(startedAt));
    setWithinLearningWindow(Date.now() - startedAt < LEARNING_WINDOW_MS);
  }, [isInstalledMobileCompanion, key]);

  return {
    isInstalledMobileCompanion,
    showGuidance: !isInstalledMobileCompanion && withinLearningWindow,
  };
}
