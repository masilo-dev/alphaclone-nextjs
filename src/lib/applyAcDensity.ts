/**
 * AlphaClone Global Density System.
 * Manages Compact (mandatory default) vs Comfortable (accessibility opt-in) modes.
 * Persisted in localStorage ('ac-density') and reflected via [data-density] on <html>.
 */

export type AcDensityMode = 'compact' | 'comfortable';

export const AC_DENSITY_STORAGE_KEY = 'ac-density';
export const DEFAULT_DENSITY: AcDensityMode = 'compact';

export function applyAcDensity(density: AcDensityMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-density', density);
  try {
    window.dispatchEvent(
      new CustomEvent('ac-density-changed', { detail: { density } })
    );
  } catch {
    /* ignore */
  }
}

export function persistAcDensity(density: AcDensityMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AC_DENSITY_STORAGE_KEY, density);
  } catch {
    /* ignore */
  }
}

export function readStoredAcDensity(): AcDensityMode {
  if (typeof window === 'undefined') return DEFAULT_DENSITY;
  try {
    const val = localStorage.getItem(AC_DENSITY_STORAGE_KEY);
    if (val === 'comfortable' || val === 'compact') return val;
  } catch {
    /* ignore */
  }
  return DEFAULT_DENSITY;
}
