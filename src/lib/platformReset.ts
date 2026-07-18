'use client';

import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cacheService } from '@/services/cacheService';

export type PlatformResetReason =
  | 'sign-out'
  | 'session-expired'
  | 'tenant-switch'
  | 'access-revoked'
  | 'account-removed';

export const PLATFORM_RESET_EVENT = 'alphaclone:platform-reset';
const RESET_CHANNEL = 'alphaclone-platform-reset-v1';
const queryClients = new Set<QueryClient>();
const objectUrls = new Set<string>();
let resetEpoch = 0;
let resetInFlight: Promise<void> | null = null;
let broadcastChannel: BroadcastChannel | null = null;

const NON_SENSITIVE_LOCAL_KEYS = [
  /^ac-theme/i,
  /^ac-language/i,
  /^ac_cookie_/i,
  /^pwa-install-/i,
  /^exit_intent_/i,
];

function shouldPreserveLocalKey(key: string): boolean {
  return NON_SENSITIVE_LOCAL_KEYS.some((pattern) => pattern.test(key));
}

function clearBrowserStorage(clearAuth: boolean): void {
  try {
    sessionStorage.clear();
  } catch {
    // Storage can be disabled by browser policy.
  }

  try {
    for (const key of Object.keys(localStorage)) {
      if (shouldPreserveLocalKey(key)) continue;
      if (!clearAuth && (key.startsWith('sb-') || key.includes('auth-token'))) continue;
      localStorage.removeItem(key);
    }
  } catch {
    // Storage can be disabled by browser policy.
  }
}

async function clearRuntimeCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => /(?:api|data|runtime|query|user|tenant)/i.test(name))
      .map((name) => caches.delete(name))
  );
}

function setupBroadcastListener(): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined' || broadcastChannel) return;
  broadcastChannel = new BroadcastChannel(RESET_CHANNEL);
  broadcastChannel.addEventListener('message', (event: MessageEvent<{ reason?: PlatformResetReason }>) => {
    const reason = event.data?.reason || 'session-expired';
    void resetPlatformState({
      reason,
      clearAuth: reason !== 'tenant-switch',
      broadcast: false,
    });
  });
}

export function registerPlatformQueryClient(queryClient: QueryClient): () => void {
  queryClients.add(queryClient);
  setupBroadcastListener();
  return () => queryClients.delete(queryClient);
}

export function registerSensitiveObjectUrl(url: string): () => void {
  objectUrls.add(url);
  return () => {
    objectUrls.delete(url);
    try {
      URL.revokeObjectURL(url);
    } catch {
      // It may already have been revoked.
    }
  };
}

export function getPlatformResetEpoch(): number {
  return resetEpoch;
}

export function getPlatformAbortSignal(): AbortSignal {
  const controller = new AbortController();
  const epoch = resetEpoch;
  const onReset = () => controller.abort(new DOMException('Platform state reset', 'AbortError'));
  window.addEventListener(PLATFORM_RESET_EVENT, onReset, { once: true });
  if (epoch !== resetEpoch) onReset();
  return controller.signal;
}

export async function resetPlatformState({
  reason,
  clearAuth,
  broadcast = true,
}: {
  reason: PlatformResetReason;
  clearAuth: boolean;
  broadcast?: boolean;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  if (resetInFlight) return resetInFlight;

  resetInFlight = (async () => {
    resetEpoch += 1;
    window.dispatchEvent(new CustomEvent(PLATFORM_RESET_EVENT, { detail: { reason } }));

    for (const queryClient of queryClients) {
      await queryClient.cancelQueries();
      queryClient.clear();
    }

    cacheService.clear();
    clearBrowserStorage(clearAuth);

    for (const url of objectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // It may already have been revoked.
      }
    }
    objectUrls.clear();

    await Promise.allSettled([
      supabase.removeAllChannels(),
      clearRuntimeCaches(),
    ]);

    if (broadcast && typeof BroadcastChannel !== 'undefined') {
      setupBroadcastListener();
      broadcastChannel?.postMessage({ reason, at: Date.now() });
    }
  })().finally(() => {
    resetInFlight = null;
  });

  return resetInFlight;
}
