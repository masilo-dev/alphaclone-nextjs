'use client';

import { useEffect, useState } from 'react';
import type { PerformanceTier } from './atmosphere.types';
import useReducedMotion from './useReducedMotion';

type NavigatorHints = Navigator & { deviceMemory?: number };

export default function useDevicePerformance(): PerformanceTier {
  const reducedMotion = useReducedMotion();
  const [tier, setTier] = useState<PerformanceTier>('reduced');

  useEffect(() => {
    if (reducedMotion) {
      setTier('static');
      return;
    }
    const hints = navigator as NavigatorHints;
    const smallScreen = window.matchMedia('(max-width: 767px)').matches;
    const constrained =
      (typeof hints.deviceMemory === 'number' && hints.deviceMemory <= 4) ||
      (typeof hints.hardwareConcurrency === 'number' && hints.hardwareConcurrency <= 4);
    setTier(smallScreen || constrained ? 'reduced' : 'full');
  }, [reducedMotion]);

  return tier;
}
