'use client';

import { useEffect } from 'react';

/** Restores a module to the place the user last worked during this session. */
export function useDashboardScrollRestoration(routeKey: string) {
  useEffect(() => {
    if (!routeKey || typeof window === 'undefined') return;
    const storageKey = `dashboard_scroll_${routeKey}`;
    const container = document.querySelector<HTMLElement>('[data-dashboard-scroll-region]');
    if (!container) return;

    const saved = Number(window.sessionStorage.getItem(storageKey));
    if (Number.isFinite(saved) && saved > 0) {
      requestAnimationFrame(() => container.scrollTo({ top: saved, behavior: 'instant' }));
    }

    const save = () => window.sessionStorage.setItem(storageKey, String(container.scrollTop));
    container.addEventListener('scroll', save, { passive: true });
    return () => {
      save();
      container.removeEventListener('scroll', save);
    };
  }, [routeKey]);
}
