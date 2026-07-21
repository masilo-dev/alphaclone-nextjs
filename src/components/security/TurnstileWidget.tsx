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
          execution?: 'render' | 'execute';
          size?: 'normal' | 'compact' | 'flexible';
          theme?: 'light' | 'dark' | 'auto';
          retry?: 'auto' | 'never';
          'refresh-expired'?: 'auto' | 'manual' | 'never';
        }
      ) => string;
      remove?: (widgetId: string) => void;
      ready?: (cb: () => void) => void;
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
      if (window.turnstile) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Turnstile script')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    // render=explicit + async — no defer (faster in OAuth popups)
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
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
  /** Prefer interaction-only so most users never wait on a visible challenge. */
  appearance?: 'always' | 'execute' | 'interaction-only';
  size?: 'normal' | 'compact' | 'flexible';
  onTokenChange: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

export default function TurnstileWidget({
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  theme = 'auto',
  className,
  appearance = 'interaction-only',
  size = 'compact',
  onTokenChange,
  onError,
  onExpire,
}: TurnstileWidgetProps) {
  const containerId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const onErrorRef = useRef(onError);
  const onExpireRef = useRef(onExpire);
  onTokenChangeRef.current = onTokenChange;
  onErrorRef.current = onError;
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!siteKey || !containerRef.current || widgetIdRef.current) {
      return;
    }

    let cancelled = false;

    const mount = () => {
      if (cancelled || !window.turnstile || !containerRef.current || widgetIdRef.current) {
        return;
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        appearance,
        size,
        retry: 'auto',
        'refresh-expired': 'auto',
        callback: (token) => onTokenChangeRef.current(token),
        'expired-callback': () => {
          onTokenChangeRef.current('');
          onExpireRef.current?.();
        },
        'error-callback': () => {
          onTokenChangeRef.current('');
          onErrorRef.current?.();
        },
      });
    };

    void loadTurnstileScript()
      .then(() => {
        if (cancelled) return;
        if (window.turnstile?.ready) {
          window.turnstile.ready(mount);
        } else {
          mount();
        }
      })
      .catch(() => {
        onErrorRef.current?.();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [appearance, siteKey, size, theme]);

  if (!siteKey) {
    return null;
  }

  return <div ref={containerRef} id={containerId} className={className} />;
}
