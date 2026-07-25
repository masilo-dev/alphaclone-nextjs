'use client';

import { useEffect, useState, type ReactNode } from 'react';
import BackgroundNoise from './BackgroundNoise';
import EdgeVignette from './EdgeVignette';

type MarketingBackgroundProps = {
  children?: ReactNode;
};

/**
 * Page-level atmospheric stack:
 * 0 root colour · 1 ambient lights · 3 noise/vignette
 * Hero waves/dots mount inside the hero section (z 2).
 */
export default function MarketingBackground({ children }: MarketingBackgroundProps) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const onVisibility = () => {
      setPaused(document.hidden);
    };
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <div
      className={`mkt-marketing-background ambient-background${paused ? ' is-paused' : ''}`}
      aria-hidden="true"
    >
      <div className="mkt-bg-root" />
      <div className="mkt-bg-ambient-lights" />
      <BackgroundNoise />
      <EdgeVignette />
      {children}
    </div>
  );
}
