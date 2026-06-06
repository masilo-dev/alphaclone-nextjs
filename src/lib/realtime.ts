import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

function isExpectedRealtimeCloseError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('WebSocket is closed before the connection is established');
}

export function isRealtimeChannel(value: unknown): value is RealtimeChannel {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as RealtimeChannel).unsubscribe === 'function'
  );
}

export function cleanupRealtimeChannel(channel: unknown): void {
  if (!isRealtimeChannel(channel)) return;

  try {
    void channel.unsubscribe();
  } catch {
    // Channel may already be closed.
  }

  void supabase.removeChannel(channel).catch((error: unknown) => {
    if (!isExpectedRealtimeCloseError(error)) {
      console.warn('[Realtime] Failed to remove channel:', error);
    }
  });
}
