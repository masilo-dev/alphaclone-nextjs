'use client';

export function isPWA(): boolean {
    if (typeof window === 'undefined') return false;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    const isAndroidReferrer = document.referrer.startsWith('android-app://');

    return isStandalone || isIOSStandalone || isAndroidReferrer;
}
