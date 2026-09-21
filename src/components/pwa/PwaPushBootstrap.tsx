'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { usePWA } from '@/contexts/PWAContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { readPwaPreferences } from '@/lib/pwa/pwaPreferences';

/**
 * Auto-subscribes to web push immediately after login when notifications
 * are enabled in PWA/mobile preferences (no delay).
 */
export function PwaPushBootstrap() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isPWA, isLoading: pwaLoading } = usePWA();
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, userTenants, isLoading: tenantLoading, switchTenant } = useTenant();
  const { pushSupported, isSubscribed, subscribeToPush } = usePushNotifications();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    const requestedTenantId = searchParams.get('notificationTenant');
    if (!requestedTenantId || authLoading || tenantLoading || !user?.id) return;

    const cleanParams = new URLSearchParams(searchParams.toString());
    cleanParams.delete('notificationTenant');
    const cleanTarget = `${pathname || '/dashboard'}${cleanParams.size ? `?${cleanParams.toString()}` : ''}`;

    if (currentTenant?.id === requestedTenantId) {
      router.replace(cleanTarget, { scroll: false });
      return;
    }

    if (!userTenants.some((tenant) => tenant.id === requestedTenantId)) {
      router.replace(cleanTarget, { scroll: false });
      return;
    }

    // switchTenant persists the workspace and reloads the deep link. On the
    // next boot the branch above removes the one-time routing parameter.
    void switchTenant(requestedTenantId).catch(() => {
      router.replace(cleanTarget, { scroll: false });
    });
  }, [
    authLoading,
    currentTenant?.id,
    pathname,
    router,
    searchParams,
    switchTenant,
    tenantLoading,
    user?.id,
    userTenants,
  ]);

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
