/** Returns true only when browser push APIs exist and this is not an embedded/dev shell. */
export function isPushSupported(): boolean {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) return false;
    if (!('serviceWorker' in navigator)) return false;
    if (!('PushManager' in window)) return false;
    const publicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
    if (!publicKey) return false;

    // Cursor's embedded browser reports APIs but push service is unavailable.
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('cursor') || ua.includes('electron')) return false;

    return true;
}

export function isPushUnavailableError(err: unknown): boolean {
    if (!err) return false;
    const name = err instanceof Error ? err.name : '';
    const message = err instanceof Error ? err.message : String(err);
    return (
        name === 'AbortError' ||
        name === 'NotSupportedError' ||
        message.includes('push service not available') ||
        message.includes('Registration failed') ||
        message.includes('not supported')
    );
}
