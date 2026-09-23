'use client';

import { useEffect, useRef } from 'react';

export const TAB_VISIBLE_EVENT = 'ac:tab-visible';

export interface TabVisibleDetail {
  timestamp: number;
  source: 'visibilitychange' | 'focus' | 'online' | 'manual';
}

let lastBroadcastTime = 0;
const DEFAULT_COOLDOWN_MS = 5000;
let isInitialized = false;

/**
 * Dispatches a throttled `ac:tab-visible` event across the window.
 * Ensures rapid visibility + focus + online bursts only trigger a single event.
 */
export function broadcastTabVisible(
  source: TabVisibleDetail['source'] = 'manual',
  cooldownMs: number = DEFAULT_COOLDOWN_MS,
  force = false,
): boolean {
  if (typeof window === 'undefined') return false;

  const now = Date.now();
  if (!force && now - lastBroadcastTime < cooldownMs) {
    return false;
  }

  lastBroadcastTime = now;
  try {
    const detail: TabVisibleDetail = { timestamp: now, source };
    window.dispatchEvent(new CustomEvent(TAB_VISIBLE_EVENT, { detail }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Initializes global browser listeners for visibilitychange, focus, and online.
 * Safe to call multiple times (idempotent).
 */
export function initTabFocusCoordinator(cooldownMs: number = DEFAULT_COOLDOWN_MS): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  if (isInitialized) {
    return () => {};
  }
  isInitialized = true;

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      broadcastTabVisible('visibilitychange', cooldownMs);
    }
  };

  const onWindowFocus = () => {
    if (document.visibilityState === 'visible') {
      broadcastTabVisible('focus', cooldownMs);
    }
  };

  const onOnline = () => {
    broadcastTabVisible('online', 1000, true);
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('focus', onWindowFocus);
  window.addEventListener('online', onOnline);

  return () => {
    isInitialized = false;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('focus', onWindowFocus);
    window.removeEventListener('online', onOnline);
  };
}

/**
 * React hook that invokes a callback whenever the user returns to the tab or window.
 * Events are deduplicated and throttled by `cooldownMs`.
 */
export function useOnTabVisible(
  callback: (detail: TabVisibleDetail) => void,
  options?: { cooldownMs?: number; enabled?: boolean },
) {
  const { cooldownMs = DEFAULT_COOLDOWN_MS, enabled = true } = options || {};
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const lastFiredRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;

    // Ensure coordinator listeners are active
    initTabFocusCoordinator(cooldownMs);

    const handler = (event: Event) => {
      const now = Date.now();
      if (now - lastFiredRef.current < cooldownMs) {
        return;
      }
      lastFiredRef.current = now;

      const detail =
        (event as CustomEvent<TabVisibleDetail>).detail ||
        ({ timestamp: now, source: 'manual' } as TabVisibleDetail);

      callbackRef.current(detail);
    };

    window.addEventListener(TAB_VISIBLE_EVENT, handler);
    return () => window.removeEventListener(TAB_VISIBLE_EVENT, handler);
  }, [cooldownMs, enabled]);
}
