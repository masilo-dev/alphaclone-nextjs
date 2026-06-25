'use client';

import { useEffect } from 'react';
import { registerServiceWorkerSafely } from '@/lib/pwa/registerServiceWorker';

/** Registers/updates the service worker on every production page load. */
export default function ServiceWorkerBootstrap() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production') return;

        void registerServiceWorkerSafely().then((registration) => {
            if (!registration) return;

            registration.addEventListener('updatefound', () => {
                const worker = registration.installing;
                if (!worker) return;

                worker.addEventListener('statechange', () => {
                    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                        worker.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            });
        });
    }, []);

    return null;
}
