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
                const head = await fetch('/sw.js', { method: 'HEAD', cache: 'no-store' });
                if (!head.ok) {
                    return null;
                }

                const existing = await navigator.serviceWorker.getRegistration('/');
                const existingPath = existing?.active ? new URL(existing.active.scriptURL).pathname : null;
                const registration =
                    !existing || existingPath !== '/sw.js'
                        ? await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
                        : existing;

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
