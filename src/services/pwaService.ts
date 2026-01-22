/**
 * PWA Service - Handles Progressive Web App features
 */

import { supabase } from '../lib/supabase';
import { ENV } from '../config/env';

/**
 * Helper to convert VAPID key
 */
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
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

export const pwaService = {
    /**
     * Check if app is installable
     */
    isInstallable(): boolean {
        if (typeof window === 'undefined') return false;

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            return false;
        }

        // Check if beforeinstallprompt event is supported
        return 'serviceWorker' in navigator;
    },

    /**
     * Register service worker
     */
    async registerServiceWorker(): Promise<{ success: boolean; error: string | null }> {
        if (!('serviceWorker' in navigator)) {
            return { success: false, error: 'Service workers not supported' };
        }

        try {
            const registration = await navigator.serviceWorker.register('/sw-improved.js', {
                scope: '/',
            });

            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker available
                            this.showUpdateNotification();
                        }
                    });
                }
            });

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Service worker registration failed',
            };
        }
    },

    /**
     * Show update notification
     */
    showUpdateNotification(): void {
        if (typeof window === 'undefined') return;

        const notification = document.createElement('div');
        notification.className = 'fixed bottom-4 right-4 bg-teal-600 text-white px-6 py-4 rounded-lg shadow-lg z-50 flex items-center gap-4';
        notification.innerHTML = `
            <div>
                <p class="font-semibold">Update Available</p>
                <p class="text-sm opacity-90">A new version is available. Refresh to update.</p>
            </div>
            <button id="pwa-update-btn" class="px-4 py-2 bg-white text-teal-600 rounded font-semibold hover:bg-teal-50 transition-colors">
                Update
            </button>
        `;

        document.body.appendChild(notification);

        const updateBtn = notification.querySelector('#pwa-update-btn');
        updateBtn?.addEventListener('click', () => {
            window.location.reload();
        });

        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            notification.remove();
        }, 10000);
    },

    /**
     * Request notification permission
     */
    async requestNotificationPermission(): Promise<{ granted: boolean; error: string | null }> {
        if (!('Notification' in window)) {
            return { granted: false, error: 'Notifications not supported' };
        }

        if (Notification.permission === 'granted') {
            return { granted: true, error: null };
        }

        try {
            const permission = await Notification.requestPermission();
            return { granted: permission === 'granted', error: null };
        } catch (error) {
            return {
                granted: false,
                error: error instanceof Error ? error.message : 'Failed to request permission',
            };
        }
    },

    /**
     * Show notification
     */
    showNotification(title: string, options?: NotificationOptions): void {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }

        new Notification(title, {
            icon: '/logo-192.png',
            badge: '/logo-192.png',
            ...options,
        });
    },

    /**
     * Check if app is running as PWA
     */
    isRunningAsPWA(): boolean {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;
    },

    /**
     * Get install prompt
     */
    async getInstallPrompt(): Promise<{ prompt: any | null; error: string | null }> {
        if (typeof window === 'undefined') {
            return { prompt: null, error: 'Not in browser environment' };
        }

        // Listen for beforeinstallprompt event
        return new Promise((resolve) => {
            const handler = (e: Event) => {
                e.preventDefault();
                (window as any).deferredPrompt = e;
                resolve({ prompt: e, error: null });
                window.removeEventListener('beforeinstallprompt', handler);
            };

            window.addEventListener('beforeinstallprompt', handler);

            // Timeout after 5 seconds
            setTimeout(() => {
                window.removeEventListener('beforeinstallprompt', handler);
                resolve({ prompt: null, error: 'Install prompt not available' });
            }, 5000);
        });
    },

    /**
     * Prompt user to install app
     */
    async promptInstall(): Promise<{ success: boolean; error: string | null }> {
        const deferredPrompt = (window as any).deferredPrompt;
        if (!deferredPrompt) {
            return { success: false, error: 'Install prompt not available' };
        }

        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            (window as any).deferredPrompt = null;

            return { success: outcome === 'accepted', error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Install failed',
            };
        }
    },

    /**
     * Clear app cache
     */
    async clearCache(): Promise<{ success: boolean; error: string | null }> {
        if (!('caches' in window)) {
            return { success: false, error: 'Cache API not supported' };
        }

        try {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((name) => caches.delete(name)));
            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Cache clear failed',
            };
        }
    },

    /**
     * Get cache size
     */
    async getCacheSize(): Promise<{ size: number; error: string | null }> {
        if (!('caches' in window)) {
            return { size: 0, error: 'Cache API not supported' };
        }

        try {
            const cacheNames = await caches.keys();
            let totalSize = 0;

            for (const cacheName of cacheNames) {
                const cache = await caches.open(cacheName);
                const keys = await cache.keys();
                for (const key of keys) {
                    const response = await cache.match(key);
                    if (response) {
                        const blob = await response.blob();
                        totalSize += blob.size;
                    }
                }
            }

            return { size: totalSize, error: null };
        } catch (error) {
            return {
                size: 0,
                error: error instanceof Error ? error.message : 'Failed to calculate cache size',
            };
        }
    },


    /**
     * Subscribe to Push Notifications
     */
    async subscribeToPush(userId: string): Promise<{ success: boolean; error: string | null }> {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return { success: false, error: 'Push messaging not supported' };
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            // Get public key from ENV
            const vapidPublicKey = ENV.VITE_VAPID_PUBLIC_KEY;

            if (!vapidPublicKey) {
                console.error('VAPID Public Key not found');
                return { success: false, error: 'Configuration missing' };
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });

            // Send subscription to server
            const { error } = await supabase
                .from('push_subscriptions')
                .upsert({
                    user_id: userId,
                    endpoint: subscription.endpoint,
                    keys: subscription.toJSON().keys
                }, { onConflict: 'endpoint' });

            if (error) {
                console.error('Failed to save subscription:', error);
                throw new Error('Database save failed');
            }

            return { success: true, error: null };

        } catch (error) {
            console.error('Push subscription failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Subscription failed',
            };
        }
    }
};

