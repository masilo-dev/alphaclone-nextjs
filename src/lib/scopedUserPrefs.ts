/** Per-user localStorage keys so preferences don't leak between accounts on the same browser. */

export function readUserPrefKey(baseKey: string, userId?: string | null): string | null {
    if (typeof window === 'undefined') return null;
    try {
        if (userId) {
            const scoped = localStorage.getItem(`${baseKey}:${userId}`);
            if (scoped) return scoped;
        }
        return localStorage.getItem(baseKey);
    } catch {
        return null;
    }
}

export function writeUserPrefKey(baseKey: string, value: string, userId?: string | null): void {
    if (typeof window === 'undefined') return;
    try {
        if (userId) {
            localStorage.setItem(`${baseKey}:${userId}`, value);
        } else {
            localStorage.setItem(baseKey, value);
        }
    } catch {
        /* ignore */
    }
}
