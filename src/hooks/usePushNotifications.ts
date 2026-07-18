'use client';

import { useState, useEffect, useCallback } from 'react';
import { registerServiceWorkerSafely } from '@/lib/pwa/registerServiceWorker';
import { isPushSupported, isPushUnavailableError } from '@/lib/push/isPushSupported';
import { useTenant } from '@/contexts/TenantContext';

// Helper to convert VAPID public key
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function usePushNotifications() {
    const { currentTenant } = useTenant();
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [pushSupported] = useState(() => isPushSupported());

    useEffect(() => {
        if (!pushSupported) return;

        void registerServiceWorkerSafely()
            .then((reg) => {
                if (!reg) return null;
                setRegistration(reg);
                return reg.pushManager.getSubscription();
            })
            .then((sub) => {
                if (sub) setIsSubscribed(true);
            })
            .catch(() => {
                // Non-critical — service worker may be unavailable in this browser.
            });
    }, [pushSupported]);

    const subscribeToPush = useCallback(async () => {
        if (!pushSupported || !currentTenant?.id) return false;

        if (!registration) {
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                return false;
            }

            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) {
                return false;
            }

            const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedKey,
            });

            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: currentTenant.id, subscription: subscription.toJSON() }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to save push subscription on server');
            }

            setIsSubscribed(true);
            return true;
        } catch (err) {
            if (!isPushUnavailableError(err)) {
                console.warn('[PushNotifications] Subscription failed:', err);
            }
            return false;
        }
    }, [pushSupported, registration, currentTenant?.id]);

    const unsubscribeFromPush = useCallback(async () => {
        if (!registration) return false;

        try {
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                if (currentTenant?.id) {
                    await fetch('/api/push/subscribe', {
                        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tenantId: currentTenant.id, endpoint: subscription.endpoint }),
                    });
                }
                const unsubscribed = await subscription.unsubscribe();
                if (unsubscribed) {
                    setIsSubscribed(false);
                    return true;
                }
            }
            return false;
        } catch (err) {
            if (!isPushUnavailableError(err)) {
                console.warn('[PushNotifications] Unsubscription failed:', err);
            }
            return false;
        }
    }, [registration, currentTenant?.id]);

    return {
        isSubscribed,
        pushSupported,
        subscribeToPush,
        unsubscribeFromPush,
    };
}
