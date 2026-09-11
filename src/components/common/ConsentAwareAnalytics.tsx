'use client';

import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/next';
import Script from 'next/script';

const STORAGE_KEYS = ['ac_cookie_consent', 'ac_cookie_preferences'];

function readAnalyticsAllowed(): boolean {
    try {
        for (const key of STORAGE_KEYS) {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const p = JSON.parse(raw) as { analytics?: boolean };
            if (typeof p.analytics === 'boolean') return p.analytics;
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Loads Vercel Analytics and Google Analytics only after the user opts into the Analytics cookie category.
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
    return (
        <>
            <Analytics />
            {process.env.NEXT_PUBLIC_GA_ID && (
                <>
                    <Script
                        src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
                        strategy="afterInteractive"
                    />
                    <Script id="google-analytics" strategy="afterInteractive">
                        {`
                            window.dataLayer = window.dataLayer || [];
                            function gtag(){dataLayer.push(arguments);}
                            gtag('js', new Date());
                            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
                                page_path: window.location.pathname,
                            });
                        `}
                    </Script>
                </>
            )}
        </>
    );
}
