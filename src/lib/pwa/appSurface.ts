export const PWA_MOBILE_MAX_WIDTH = 767;
export const PWA_TOUCH_COMPANION_MAX_WIDTH = 1366;

export type AppSurface = 'browser' | 'pwa-mobile' | 'pwa-tablet' | 'pwa-desktop';

export interface AppSurfaceInput {
  isPwa: boolean;
  width: number;
  coarsePointer: boolean;
}

/**
 * Canonical installed-app surface resolver. Keep all runtime behavior aligned
 * with the matching selectors in alphaclone-os-v3-pwa.css.
 */
export function resolveAppSurface({ isPwa, width, coarsePointer }: AppSurfaceInput): AppSurface {
  if (!isPwa) return 'browser';
  if (width <= PWA_MOBILE_MAX_WIDTH) return 'pwa-mobile';
  if (coarsePointer && width <= PWA_TOUCH_COMPANION_MAX_WIDTH) return 'pwa-tablet';
  return 'pwa-desktop';
}
