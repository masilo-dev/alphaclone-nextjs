'use client';

import { useEffect, useRef } from 'react';
import { usePWA } from '@/contexts/PWAContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const STORAGE_KEY = 'alphaclone_pwa_push_prompt_v1';

/**
 * On installed PWA, gently prompts for OS notification permission once
 * so users receive message/call alerts when the app is backgrounded.
 */
export function PwaPushBootstrap() {
  const { isPWA, isLoading } = usePWA();
  const { pushSupported, isSubscribed, subscribeToPush } = usePushNotifications();
  const started = useRef(false);

  useEffect(() => {
    if (isLoading || !isPWA || !pushSupported || isSubscribed || started.current) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (Notification.permission === 'denied') {
      localStorage.setItem(STORAGE_KEY, 'denied');
      return;
    }

    started.current = true;
    const timer = window.setTimeout(async () => {
      const ok = await subscribeToPush();
      localStorage.setItem(STORAGE_KEY, ok ? 'granted' : Notification.permission);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [isLoading, isPWA, pushSupported, isSubscribed, subscribeToPush]);

  return null;
}
