'use client';

import { useEffect, useId, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
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
}

export default function TurnstileWidget({
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  theme = 'auto',
  className,
  onTokenChange,
  onError,
  onExpire,
}: TurnstileWidgetProps) {
  const containerId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current || widgetIdRef.current) {
      return;
    }

    let cancelled = false;

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current || widgetIdRef.current) {
          return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          appearance: 'always',
          callback: (token) => onTokenChange(token),
          'expired-callback': () => {
            widgetIdRef.current = null;
            onTokenChange('');
            onExpire?.();
          },
          'error-callback': () => {
            widgetIdRef.current = null;
            onTokenChange('');
            onError?.();
          },
        });
      })
      .catch(() => {
        onError?.();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [onError, onExpire, onTokenChange, siteKey, theme]);

  if (!siteKey) {
    return null;
  }

  return <div ref={containerRef} id={containerId} className={className} />;
}
