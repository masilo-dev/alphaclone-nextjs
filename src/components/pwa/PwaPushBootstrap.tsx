'use client';

import { useEffect, useRef } from 'react';
import { usePWA } from '@/contexts/PWAContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { readPwaPreferences } from '@/lib/pwa/pwaPreferences';

/**
 * Auto-subscribes to web push immediately after login when notifications
 * are enabled in PWA/mobile preferences (no delay).
 */
export function PwaPushBootstrap() {
  const { isPWA, isLoading: pwaLoading } = usePWA();
  const { user, loading: authLoading } = useAuth();
  const { pushSupported, isSubscribed, subscribeToPush } = usePushNotifications();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (pwaLoading || authLoading || !user?.id || !pushSupported) return;

    const prefs = readPwaPreferences();
    if (!prefs.pushEnabled) return;
    if (typeof window !== 'undefined' && Notification.permission === 'denied') return;

    const isMobile =
      typeof window !== 'undefined' &&
      (window.matchMedia('(max-width: 767px)').matches || isPWA);

    if (!isMobile && !isPWA) return;

    if (isSubscribed && lastUserId.current === user.id) return;

    if (lastUserId.current !== user.id) {
      lastUserId.current = user.id;
      void subscribeToPush();
    }
  }, [
    pwaLoading,
    authLoading,
    user?.id,
    isPWA,
    pushSupported,
    isSubscribed,
    subscribeToPush,
  ]);

  return null;
}
