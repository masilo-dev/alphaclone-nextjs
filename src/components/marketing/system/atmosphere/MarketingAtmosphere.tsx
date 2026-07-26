'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { variantForPath } from './atmosphere.config';
import type { AtmosphereIntensity, AtmosphereVariant } from './atmosphere.types';
import BackgroundNoise from './BackgroundNoise';
import EdgeVignette from './EdgeVignette';
import FluidTransitionLayer from './FluidTransitionLayer';
import OrbField from './OrbField';
import useDevicePerformance from './useDevicePerformance';
import usePointerIntent from './usePointerIntent';

type Props = {
  variant?: AtmosphereVariant;
  intensity?: AtmosphereIntensity;
  interactive?: boolean;
};

export default function MarketingAtmosphere({
  variant,
  intensity = 'subtle',
  interactive = true,
}: Props) {
  const pathname = usePathname() ?? '/';
  const tier = useDevicePerformance();
  const rootRef = useRef<HTMLDivElement>(null);
  const activeVariant = variant ?? variantForPath(pathname);

  usePointerIntent(rootRef, interactive && tier === 'full');

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    node.classList.remove('is-settled');
    const frame = window.requestAnimationFrame(() => node.classList.add('is-settled'));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <div
      ref={rootRef}
      className="mkt-marketing-background ambient-background"
      data-variant={activeVariant}
      data-intensity={intensity}
      data-performance={tier}
      aria-hidden="true"
    >
      <div className="mkt-bg-root" />
      <OrbField variant={activeVariant} />
      <FluidTransitionLayer />
      <BackgroundNoise />
      <EdgeVignette />
    </div>
  );
}
