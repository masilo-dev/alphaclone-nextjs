import type { ReactNode } from 'react';
import BackgroundNoise from './BackgroundNoise';
import EdgeVignette from './EdgeVignette';

type MarketingBackgroundProps = {
  children?: ReactNode;
};

/**
 * Page-level atmospheric stack (server-rendered for fast first paint):
 * 0 root colour · 1 ambient lights · 3 noise/vignette
 * Hero waves/dots mount inside the hero section (z 2).
 */
export default function MarketingBackground({ children }: MarketingBackgroundProps) {
  return (
    <div className="mkt-marketing-background ambient-background" aria-hidden="true">
      <div className="mkt-bg-root" />
      <div className="mkt-bg-ambient-lights" />
      <BackgroundNoise />
      <EdgeVignette />
      {children}
    </div>
  );
}
