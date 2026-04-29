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

export default function TurnstileVerification({
    onVerify,
    onExpire,
    onError,
    theme = 'dark',
}: TurnstileVerificationProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const mountedRef = useRef(true);
    const lastErrorRef = useRef<string | null>(null);
    const [isScriptLoaded, setIsScriptLoaded] = useState(false);
    const [fatalError, setFatalError] = useState<string | null>(null);
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const allowedHosts = (process.env.NEXT_PUBLIC_TURNSTILE_ALLOWED_HOSTS || 'alphaclonesystems.com,www.alphaclonesystems.com,localhost,127.0.0.1')
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);

    useEffect(() => {
        mountedRef.current = true;

        if (!siteKey || siteKey === 'your_site_key_here') {
            const message = 'Security verification is not configured. Please contact support.';
            console.error('Cloudflare Turnstile site key is not configured');
            setFatalError(message);
            onError?.(message);
            return;
        }

        const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
        const hostAllowed = allowedHosts.includes(host) || host.endsWith('.vercel.app');
        if (!hostAllowed) {
            const message = `Security verification is disabled on ${host}. Use an approved domain: ${allowedHosts.join(', ')}`;
            console.warn('[Turnstile] Host is not in NEXT_PUBLIC_TURNSTILE_ALLOWED_HOSTS and not a vercel app:', host);
            setFatalError(message);
            onError?.(message);
            return;
        }

        ensureTurnstileScript()
            .then(() => {
                if (mountedRef.current) {
                    setIsScriptLoaded(true);
                }
            })
            .catch((error) => {
                if (!mountedRef.current) return;
                console.error('Error loading Turnstile script:', error);
                const message = 'Security verification could not load. Please refresh and try again.';
                setFatalError(message);
                onError?.(message);
            });

        return () => {
            mountedRef.current = false;
        };
    }, [siteKey, onError, allowedHosts]);

    useEffect(() => {
        if (fatalError || !isScriptLoaded || !containerRef.current || widgetIdRef.current || !window.turnstile) {
            return;
        }

        let disposed = false;

        try {
            widgetIdRef.current = window.turnstile.render(containerRef.current, {
                sitekey: siteKey!,
                theme,
                callback: (token: string) => {
                    if (disposed || !mountedRef.current) return;
                    lastErrorRef.current = null;
                    onVerify(token);
                },
                'expired-callback': () => {
                    if (disposed || !mountedRef.current) return;
                    onExpire?.();
                },
                'error-callback': (code?: string | number) => {
                    if (disposed || !mountedRef.current) return;

                    // Handle error 600010 (initialization/token fetch failure) with an automatic retry
                    if (code === '600010' || code === 600010) {
                        console.warn('[Turnstile] Error 600010 detected, attempting re-render...');
                        if (widgetIdRef.current && window.turnstile) {
                            try {
                                // Guard the reset call as per recommendations
                                if (window.turnstile.getResponse(widgetIdRef.current) !== undefined) {
                                    window.turnstile.reset(widgetIdRef.current);
                                    return;
                                }
                            } catch (e) {
                                console.error('[Turnstile] Reset failed:', e);
                            }
                        }
                    }

                    const host = typeof window !== 'undefined' ? window.location.hostname : 'current host';
                    const message =
                        `Security verification is unavailable on ${host}. Please refresh, disable strict browser extensions for this page, or contact support.`;

                    if (lastErrorRef.current === message) {
                        return;
                    }

                    lastErrorRef.current = message;
                    setFatalError(message);
                    onError?.(message);
                },
            });
        } catch (err) {
            console.error('Error rendering Turnstile:', err);
            const message = 'Security verification could not initialize. Please refresh and try again.';
            setFatalError(message);
            onError?.(message);
        }

        return () => {
            disposed = true;
            const widgetId = widgetIdRef.current;
            widgetIdRef.current = null;

            if (widgetId && window.turnstile) {
                try {
                    window.turnstile.remove(widgetId);
                } catch {
                    // Ignore stale widget cleanup errors from route transitions/remounts.
                }
            }

            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [fatalError, isScriptLoaded, onError, onExpire, onVerify, siteKey, theme]);

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
