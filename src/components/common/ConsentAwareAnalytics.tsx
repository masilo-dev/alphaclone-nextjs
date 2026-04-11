'use client';

import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/next';

const STORAGE_KEY = 'ac_cookie_preferences';

function readAnalyticsAllowed(): boolean {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const p = JSON.parse(raw) as { analytics?: boolean };
        return Boolean(p.analytics);
    } catch {
        return false;
    }
}

/**
 * Loads Vercel Analytics only after the user opts into the Analytics cookie category.
 */
export function ConsentAwareAnalytics() {
    const [allow, setAllow] = useState(false);

    useEffect(() => {
        setAllow(readAnalyticsAllowed());
        const onConsent = () => setAllow(readAnalyticsAllowed());
        window.addEventListener('ac:cookie-consent', onConsent);
        return () => window.removeEventListener('ac:cookie-consent', onConsent);
    }, []);

    if (!allow) return null;
    return <Analytics />;
}
