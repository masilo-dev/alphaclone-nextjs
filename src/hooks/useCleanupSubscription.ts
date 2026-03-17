import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/**
 * Automatically cleanup Supabase subscriptions to prevent memory leaks
 * 
 * Usage:
 * useCleanupSubscription(() => {
 *   const channel = supabase.channel('my-channel').subscribe();
 *   return channel;
 * }, [dependencies]);
 */
export function useCleanupSubscription(
  subscribeCallback: () => RealtimeChannel,
  deps: React.DependencyList
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // Create subscription
    channelRef.current = subscribeCallback();

    // Cleanup function
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, deps);

  return channelRef;
}

/**
 * Batch multiple subscription cleanups
 */
export function useBatchCleanupSubscriptions(
  subscriptions: Array<() => RealtimeChannel>,
  deps: React.DependencyList
) {
  const channelsRef = useRef<RealtimeChannel[]>([]);

  useEffect(() => {
    // Create all subscriptions
    channelsRef.current = subscriptions.map(subscribe => subscribe());

    // Cleanup all
    return () => {
      channelsRef.current.forEach(channel => {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  }, deps);

  return channelsRef;
}




