const PURGE_KEY = 'pwa_purge_v2';

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

async function purgeStaleServiceWorkerCaches(): Promise<void> {
    if (typeof window === 'undefined' || window.localStorage?.getItem(PURGE_KEY) === '1') {
        return;
    }

    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ('caches' in window) {
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map((key) => caches.delete(key)));
        }

        window.localStorage.setItem(PURGE_KEY, '1');
    } catch {
        // Non-fatal — continue with fresh registration attempt.
    }
}

export async function registerServiceWorkerSafely(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return null;
    }

    if (process.env.NODE_ENV !== 'production') {
        return null;
    }

    if (!registrationPromise) {
        registrationPromise = (async () => {
            try {
                await purgeStaleServiceWorkerCaches();

                const head = await fetch('/sw.js', { method: 'HEAD', cache: 'no-store' });
                if (!head.ok) {
                    return null;
                }

                const existing = await navigator.serviceWorker.getRegistration('/');
                const registration =
                    existing ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }));

                try {
                    await registration.update();
                } catch {
                    // update() can fail offline — keep existing registration.
                }

                return registration;
            } catch {
                return null;
            }
        })();
    }

    return registrationPromise;
}
