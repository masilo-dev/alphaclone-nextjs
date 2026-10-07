let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function activateAuthPageUpdate(registration: ServiceWorkerRegistration): void {
    // Login has no authenticated drafts to preserve. Adopt the fixed worker
    // there, while dashboard updates continue to require the existing prompt.
    if (!/^\/(?:auth(?:\/|$)|login(?:\/|$)|portal-login(?:\/|$))/.test(window.location.pathname)) return;
    const activateWaiting = () => registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    activateWaiting();
    const watchInstalling = () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed') activateWaiting();
        });
    };
    watchInstalling();
    registration.addEventListener('updatefound', watchInstalling);
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

                activateAuthPageUpdate(registration);

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
