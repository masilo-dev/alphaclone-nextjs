import type { ReactNode } from 'react';
import MarketingAtmosphere from './MarketingAtmosphere';

type MarketingBackgroundProps = {
  children?: ReactNode;
};

/**
 * Page-level atmospheric stack (server-rendered for fast first paint):
 * 0 root colour · 1 drifting ambient orbs · 3 noise/vignette
 * Hero waves/dots mount inside the hero section (z 2).
 */
export default function MarketingBackground({ children }: MarketingBackgroundProps) {
  return (
    <>
      <MarketingAtmosphere />
      {children}
    </>
  );
}
