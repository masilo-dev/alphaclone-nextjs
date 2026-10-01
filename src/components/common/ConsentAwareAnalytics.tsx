'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { readConsentState, initGoogleConsentModeDefaults, CONSENT_CHANGE_EVENT } from '@/lib/consent/consentManager';

/**
 * Loads Google Analytics only after the user explicitly grants Analytics consent.
 * Governs all hits via Google Consent Mode v2 signals.
 */
export function ConsentAwareAnalytics() {
  const [allow, setAllow] = useState(false);

  useEffect(() => {
    // 1. Establish Google Consent Mode v2 denied defaults immediately
    initGoogleConsentModeDefaults();

    // 2. Read initial state
    const current = readConsentState();
    setAllow(Boolean(current?.analytics));

    // 3. Listen for consent updates
    const onConsent = () => {
      const updated = readConsentState();
      setAllow(Boolean(updated?.analytics));
    };

    window.addEventListener(CONSENT_CHANGE_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onConsent);
  }, []);

  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  if (!allow || !gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}', {
            page_path: window.location.pathname,
            anonymize_ip: true
          });
        `}
      </Script>
    </>
  );
}
