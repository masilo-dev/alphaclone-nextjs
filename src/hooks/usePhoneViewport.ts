'use client';
import { useEffect } from 'react';

/** iOS keeps the layout viewport tall while the keyboard shrinks the visible viewport. */
export function usePhoneViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const phone = window.matchMedia('(max-width: 767px)').matches;
      const keyboardOpen = phone && window.innerHeight - viewport.height > 120;
      document.documentElement.style.setProperty('--ac-visible-height', `${viewport.height}px`);
      document.documentElement.dataset.keyboardOpen = String(keyboardOpen);
    };
    update();
    viewport.addEventListener('resize', update);
    window.addEventListener('resize', update);
    return () => {
      viewport.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
      document.documentElement.style.removeProperty('--ac-visible-height');
      delete document.documentElement.dataset.keyboardOpen;
    };
  }, []);
}
