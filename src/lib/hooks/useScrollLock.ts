/**
 * useScrollLock — Applies `html.ac-scroll-lock` for the lifetime of the calling component.
 *
 * Safe no-op on the server. When `enabled` is true (default), the document scroll
 * locks. Pass `false` to opt out. Safe for nested dialogs (reference-counted —
 * when two modals are open, the last unmount does not break the outer's lock).
 */
import * as React from 'react';

let openCount = 0;

export function useScrollLock(enabled = true, deps: React.DependencyList = []) {
  React.useEffect(() => {
    if (typeof document === 'undefined' || !enabled) return;
    const html = document.documentElement;
    openCount += 1;
    html.classList.add('ac-scroll-lock');
    const scrollTop = window.scrollY;
    html.style.setProperty('--ac-scroll-top', `${scrollTop}px`);
    return () => {
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) {
        html.classList.remove('ac-scroll-lock');
        html.style.removeProperty('--ac-scroll-top');
      }
    };
  }, [enabled, ...deps]);
}
