'use client';

import { useEffect } from 'react';
import { registerServiceWorkerSafely } from '@/lib/pwa/registerServiceWorker';

/** Registers the service worker in production without forcing mid-session activation. */
export default function ServiceWorkerBootstrap() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production') return;
        void registerServiceWorkerSafely();
    }, []);

    return null;
}
