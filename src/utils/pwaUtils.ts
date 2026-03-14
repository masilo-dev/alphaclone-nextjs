'use client';

export function isPWA(): boolean {
    if (typeof window === 'undefined') return false;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    const isAndroidReferrer = document.referrer.startsWith('android-app://');
    
    // Check for mode=pwa query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const isPwaParam = urlParams.get('mode') === 'pwa';

    return isStandalone || isIOSStandalone || isAndroidReferrer || isPwaParam;
}

