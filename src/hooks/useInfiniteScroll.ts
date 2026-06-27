'use client';

import { useEffect, type RefObject } from 'react';

interface UseInfiniteScrollOptions {
  enabled?: boolean;
  /** 0–1 scroll depth before loading (default 0.8) */
  threshold?: number;
}

/**
 * Auto-load next batch when user scrolls past threshold (enterprise list pattern).
 */
export function useInfiniteScroll(
  containerRef: RefObject<HTMLElement | null>,
  onLoadMore: () => void,
  { enabled = true, threshold = 0.8 }: UseInfiniteScrollOptions = {}
) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight <= clientHeight) return;
      const ratio = (scrollTop + clientHeight) / scrollHeight;
      if (ratio >= threshold) onLoadMore();
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [containerRef, enabled, onLoadMore, threshold]);
}
