let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

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
                const existing = await navigator.serviceWorker.getRegistration('/');
                if (existing) return existing;

                const head = await fetch('/sw.js', { method: 'HEAD', cache: 'no-store' });
                if (!head.ok) {
                    return null;
                }

                return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            } catch {
                return null;
            }
        })();
    }

    return registrationPromise;
}
