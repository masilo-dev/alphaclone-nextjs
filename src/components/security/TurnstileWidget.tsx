'use client';

import { useEffect, useId, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          appearance?: 'always' | 'execute' | 'interaction-only';
          theme?: 'light' | 'dark' | 'auto';
        }
      ) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

/**
 * Sentinel value used when `bypassOnError` is true — callers and
 * `verifyTurnstile.ts` both recognise this constant so it is never
 * confused with a real Cloudflare token or a fake string.
 */
export const TURNSTILE_BYPASS_TOKEN = '__turnstile_bypass__';

const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-script';
let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.turnstile) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Turnstile script')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Turnstile script'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

interface TurnstileWidgetProps {
  siteKey?: string;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
  onTokenChange: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  /**
   * When true, a load-timeout or JS error causes the widget to emit
   * TURNSTILE_BYPASS_TOKEN instead of blocking the form forever.
   * Only use this for non-critical forms where security can be relaxed.
   * Default: false (form stays blocked on failure).
   */
  bypassOnError?: boolean;
}

export default function TurnstileWidget({
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  theme = 'auto',
  className,
  onTokenChange,
  onError,
  onExpire,
  bypassOnError = false,
}: TurnstileWidgetProps) {
  const containerId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const onErrorRef = useRef(onError);
  const onExpireRef = useRef(onExpire);

  // Parent forms commonly pass inline callbacks. Keep the latest handlers
  // without destroying a verified widget every time its token updates state.
  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
    onErrorRef.current = onError;
    onExpireRef.current = onExpire;
  }, [onError, onExpire, onTokenChange]);

  useEffect(() => {
    if (!siteKey || !containerRef.current || widgetIdRef.current) {
      return;
    }

    let cancelled = false;

    /**
     * Timeout safety net: if Cloudflare Turnstile hangs for > 8s without
     * rendering, either bypass (if opted-in) or fire onError so the caller
     * can surface a clear "security check unavailable" message.
     * We intentionally do NOT emit a fake truthy token here — that would
     * let the submit-button guard think the challenge passed.
     */
    const timeoutTimer = setTimeout(() => {
      if (!cancelled && !widgetIdRef.current) {
        console.warn('[TurnstileWidget] Cloudflare Turnstile challenge timeout.');
        if (bypassOnError) {
          onTokenChangeRef.current(TURNSTILE_BYPASS_TOKEN);
        } else {
          onErrorRef.current?.();
        }
      }
    }, 8000);

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current || widgetIdRef.current) {
          clearTimeout(timeoutTimer);
          return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: 'turnstile-spin-v2',
          theme,
          appearance: 'always',
          callback: (token) => {
            clearTimeout(timeoutTimer);
            onTokenChangeRef.current(token);
          },
          'expired-callback': () => {
            clearTimeout(timeoutTimer);
            onTokenChangeRef.current('');
            onExpireRef.current?.();
          },
          'error-callback': () => {
            clearTimeout(timeoutTimer);
            if (bypassOnError) {
              onTokenChangeRef.current(TURNSTILE_BYPASS_TOKEN);
            } else {
              // Emit empty string so the submit-button disabled guard remains
              // active, then fire the caller's onError for UI feedback.
              onTokenChangeRef.current('');
              onErrorRef.current?.();
            }
          },
        });
      })
      .catch(() => {
        clearTimeout(timeoutTimer);
        if (bypassOnError) {
          onTokenChangeRef.current(TURNSTILE_BYPASS_TOKEN);
        } else {
          onTokenChangeRef.current('');
          onErrorRef.current?.();
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutTimer);
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [bypassOnError, siteKey, theme]);

  if (!siteKey) {
    return null;
  }

  return <div ref={containerRef} id={containerId} className={className} />;
}
