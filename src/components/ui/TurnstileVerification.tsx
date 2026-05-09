'use client';

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';

interface TurnstileVerificationProps {
    onVerify: (token: string) => void;
    onExpire?: () => void;
    onError?: (message?: string) => void;
    theme?: 'light' | 'dark' | 'auto';
}

export interface TurnstileRef {
    reset: () => void;
}

declare global {
    interface Window {
        turnstile?: {
            render: (
                container: string | HTMLElement,
                options: {
                    sitekey: string;
                    callback: (token: string) => void;
                    'expired-callback'?: () => void;
                    'error-callback'?: (code?: string | number) => void;
                    theme?: 'light' | 'dark' | 'auto';
                }
            ) => string;
            remove: (widgetId: string) => void;
            reset: (widgetId: string) => void;
            getResponse: (widgetId: string) => string | undefined;
        };
    }
}

let turnstileScriptPromise: Promise<void> | null = null;

function ensureTurnstileScript(): Promise<void> {
    if (typeof window === 'undefined') {
        return Promise.resolve();
    }

    if (window.turnstile) {
        return Promise.resolve();
    }

    if (turnstileScriptPromise) {
        return turnstileScriptPromise;
    }

    turnstileScriptPromise = new Promise<void>((resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>('script[src*="turnstile/v0/api.js"]');

        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(), { once: true });
            existingScript.addEventListener('error', () => reject(new Error('Turnstile failed to load')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Turnstile failed to load'));
        document.head.appendChild(script);
    }).finally(() => {
        if (!window.turnstile) {
            turnstileScriptPromise = null;
        }
    });

    return turnstileScriptPromise;
}

const TurnstileVerification = forwardRef<TurnstileRef, TurnstileVerificationProps>(({
    onVerify,
    onExpire,
    onError,
    theme = 'dark',
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const mountedRef = useRef(true);
    const lastErrorRef = useRef<string | null>(null);
    const [isScriptLoaded, setIsScriptLoaded] = useState(false);
    const [showLoadingMessage, setShowLoadingMessage] = useState(false);
    const [fatalError, setFatalError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
        reset: () => {
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.reset(widgetIdRef.current);
                } catch (e) {
                    console.error('[Turnstile] Manual reset failed:', e);
                }
            }
        }
    }));
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const allowedHosts = (process.env.NEXT_PUBLIC_TURNSTILE_ALLOWED_HOSTS || 'alphaclonesystems.com,www.alphaclonesystems.com,localhost,127.0.0.1')
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);

    // HIDE Turnstile completely as per user request. 
    // We auto-call onVerify with a dummy token to prevent blocking form submissions.
    useEffect(() => {
        onVerify('disabled-bypass-token');
    }, [onVerify]);

    return null;
});

export default TurnstileVerification;
