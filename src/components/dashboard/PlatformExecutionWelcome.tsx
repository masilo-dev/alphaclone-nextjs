'use client';

export const PLATFORM_TOUR_EVENT = 'alphaclone:start-product-tour';

export function requestPlatformTour() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PLATFORM_TOUR_EVENT));
}

interface PlatformExecutionWelcomeProps {
  userId: string;
  surface: 'home' | 'projects' | 'platform';
  className?: string;
}

/** Compatibility adapter for module imports. Guidance now belongs to the
 * first-run picker, passive checklist, and intentional Help replay entry. */
export function PlatformExecutionWelcome(_props: PlatformExecutionWelcomeProps) {
  return null;
}
