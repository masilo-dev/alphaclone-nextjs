'use client';

import React, { useEffect, useRef, useState } from 'react';

interface TurnstileVerificationProps {
    onVerify: (token: string) => void;
    onExpire?: () => void;
    onError?: (message?: string) => void;
    theme?: 'light' | 'dark' | 'auto';
}

declare global {
    interface Window {
        onloadTurnstileCallback: () => void;
        turnstile: {
            render: (
                container: string | HTMLElement,
                options: {
                    sitekey: string;
                    callback: (token: string) => void;
                    'expired-callback'?: () => void;
                    'error-callback'?: () => void;
                    theme?: 'light' | 'dark' | 'auto';
                }
            ) => string;
            reset: (widgetId: string) => void;
            remove: (widgetId: string) => void;
        };
    }
}

export default function TurnstileVerification({
    onVerify,
    onExpire,
    onError,
    theme = 'dark',
}: TurnstileVerificationProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const mountedRef = useRef(true);
    const [isScriptLoaded, setIsScriptLoaded] = useState(false);
    const [fatalError, setFatalError] = useState<string | null>(null);
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    useEffect(() => {
        mountedRef.current = true;

        // Site key check
        if (!siteKey || siteKey === 'your_site_key_here') {
            const message = 'Security verification is not configured. Please contact support.';
            console.error('Cloudflare Turnstile site key is not configured');
            setFatalError(message);
            if (onError) onError(message);
            return;
        }

        // Define the callback before loading the script
        window.onloadTurnstileCallback = () => {
            if (mountedRef.current) {
                setIsScriptLoaded(true);
            }
        };

        // Suppress multiple script loads
        if (document.querySelector('script[src*="turnstile/v0/api.js"]')) {
            if (window.turnstile) {
                setIsScriptLoaded(true);
            }
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);

        return () => {
            mountedRef.current = false;
            // Cleanup: remove the callback if the component unmounts before script loads
            delete (window as any).onloadTurnstileCallback;
        };
    }, [siteKey]);

    useEffect(() => {
        if (fatalError) return;

        if (isScriptLoaded && containerRef.current && !widgetIdRef.current) {
            try {
                widgetIdRef.current = window.turnstile.render(containerRef.current, {
                    sitekey: siteKey!,
                    theme: theme,
                    callback: (token: string) => {
                        onVerify(token);
                    },
                    'expired-callback': () => {
                        if (onExpire) onExpire();
                        // Avoid reset() calls on widgets already disposed by route transitions.
                        // Those trigger noisy "Cannot find Widget" warnings from Turnstile.
                    },
                    'error-callback': () => {
                        const host = typeof window !== 'undefined' ? window.location.hostname : 'current host';
                        const message =
                            `Security verification is unavailable on ${host}. Please refresh, disable strict browser extensions for this page, or contact support.`;
                        setFatalError(message);
                        if (widgetIdRef.current && window.turnstile) {
                            try {
                                window.turnstile.remove(widgetIdRef.current);
                            } catch {}
                            widgetIdRef.current = null;
                        }
                        if (onError) onError(message);
                    },
                });
            } catch (err) {
                console.error('Error rendering Turnstile:', err);
                const message = 'Security verification could not initialize. Please refresh and try again.';
                setFatalError(message);
                if (onError) onError(message);
            }
        }

        return () => {
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch {
                    // Ignore stale widget cleanup errors.
                }
                widgetIdRef.current = null;
            }
        };
    }, [isScriptLoaded, onVerify, onExpire, onError, siteKey, theme, fatalError]);

    if (fatalError) {
        return (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs">
                {fatalError}
            </div>
        );
    }

    return (
        <div className="w-full flex justify-center py-2 min-h-[65px]">
            <div ref={containerRef} />
        </div>
    );
}
