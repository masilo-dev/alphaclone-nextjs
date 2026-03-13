'use client';

import React, { useEffect, useRef, useState } from 'react';

interface TurnstileVerificationProps {
    onVerify: (token: string) => void;
    onExpire?: () => void;
    onError?: () => void;
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
    const [isScriptLoaded, setIsScriptLoaded] = useState(false);
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    useEffect(() => {
        // Site key check
        if (!siteKey || siteKey === 'your_site_key_here') {
            console.error('Cloudflare Turnstile site key is not configured');
            return;
        }

        // Define the callback before loading the script
        window.onloadTurnstileCallback = () => {
            setIsScriptLoaded(true);
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
            // Cleanup: remove the callback if the component unmounts before script loads
            delete (window as any).onloadTurnstileCallback;
        };
    }, [siteKey]);

    useEffect(() => {
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
                        if (widgetIdRef.current) window.turnstile.reset(widgetIdRef.current);
                    },
                    'error-callback': () => {
                        if (onError) onError();
                    },
                });
            } catch (err) {
                console.error('Error rendering Turnstile:', err);
            }
        }

        return () => {
            if (widgetIdRef.current && window.turnstile) {
                // We don't necessarily want to remove it every render, but on unmount
                // window.turnstile.remove(widgetIdRef.current);
                // widgetIdRef.current = null;
            }
        };
    }, [isScriptLoaded, onVerify, onExpire, onError, siteKey, theme]);

    if (!siteKey || siteKey === 'your_site_key_here') {
        return (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs">
                Turnstile site key missing. Please check your configuration.
            </div>
        );
    }

    return (
        <div className="w-full flex justify-center py-2 min-h-[65px]">
            <div ref={containerRef} />
        </div>
    );
}
