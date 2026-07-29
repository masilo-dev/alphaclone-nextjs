'use client';

import { useState, useEffect, useCallback } from 'react';
<<<<<<< HEAD
import { registerServiceWorkerSafely } from '@/lib/pwa/registerServiceWorker';
import { isPushSupported, isPushUnavailableError } from '@/lib/push/isPushSupported';
import { useTenant } from '@/contexts/TenantContext';
=======
>>>>>>> origin/main

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
<<<<<<< HEAD
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
=======
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    // Register Service Worker
    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker
                .register('/sw.js')
                .then((reg) => {
                    if (process.env.NODE_ENV === 'development') {
                        console.log('[PushNotifications] Service Worker registered:', reg);
                    }
                    setRegistration(reg);
                    
                    // Check if already subscribed
                    return reg.pushManager.getSubscription();
                })
                .then((sub) => {
                    setIsSubscribed(!!sub);
                })
                .catch((err) => {
                    console.error('[PushNotifications] SW registration/check failed:', err);
                });
        }
    }, []);

    // Subscribe function
    const subscribeToPush = useCallback(async () => {
        if (!registration) {
            console.error('[PushNotifications] Service worker registration not ready');
>>>>>>> origin/main
            return false;
        }

        try {
<<<<<<< HEAD
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                return false;
            }

            const vapidPublicKey =
                process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) {
=======
            // Request user permission for notifications
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.warn('[PushNotifications] Notification permission denied');
                return false;
            }

            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) {
                console.error('[PushNotifications] NEXT_PUBLIC_VAPID_PUBLIC_KEY environment variable is not set');
>>>>>>> origin/main
                return false;
            }

            const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
<<<<<<< HEAD
                applicationServerKey: convertedKey,
            });

            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: currentTenant.id, subscription: subscription.toJSON() }),
=======
                applicationServerKey: convertedKey
            });

            // Send subscription to server
            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(subscription)
>>>>>>> origin/main
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to save push subscription on server');
            }

            setIsSubscribed(true);
            return true;
        } catch (err) {
<<<<<<< HEAD
            if (!isPushUnavailableError(err)) {
                console.warn('[PushNotifications] Subscription failed:', err);
            }
            return false;
        }
    }, [pushSupported, registration, currentTenant?.id]);

    const unsubscribeFromPush = useCallback(async () => {
        if (!registration) return false;
=======
            console.error('[PushNotifications] Subscription failed:', err);
            return false;
        }
    }, [registration]);

    // Unsubscribe function
    const unsubscribeFromPush = useCallback(async () => {
        if (!registration) {
            console.error('[PushNotifications] Service worker registration not ready');
            return false;
        }
>>>>>>> origin/main

        try {
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
<<<<<<< HEAD
                if (currentTenant?.id) {
                    await fetch('/api/push/subscribe', {
                        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tenantId: currentTenant.id, endpoint: subscription.endpoint }),
                    });
                }
=======
>>>>>>> origin/main
                const unsubscribed = await subscription.unsubscribe();
                if (unsubscribed) {
                    setIsSubscribed(false);
                    return true;
                }
            }
            return false;
        } catch (err) {
<<<<<<< HEAD
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
=======
            console.error('[PushNotifications] Unsubscription failed:', err);
            return false;
        }
    }, [registration]);

    return {
        isSubscribed,
        subscribeToPush,
        unsubscribeFromPush
>>>>>>> origin/main
    };
}
