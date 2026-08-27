'use client';

import React, { useEffect, useState } from 'react';
import PullToRefresh from './PullToRefresh';

export interface DashboardScrollRegionProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  /** When false, content uses a non-scrolling shell (e.g. mail with inner scroll). */
  scrollable?: boolean;
}

/**
 * Mobile: native pull-to-refresh on the primary dashboard scroll container.
 * Desktop: standard overflow scroll without pull gesture.
 */
export function DashboardScrollRegion({
  onRefresh,
  children,
  className = '',
  scrollable = true,
}: DashboardScrollRegionProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  if (!scrollable) {
    return (
      <div className={`h-full min-h-0 overflow-hidden ${className}`}>
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <PullToRefresh
        onRefresh={onRefresh}
        className={`h-full min-h-0 scroll-smooth ${className}`}
      >
        {children}
      </PullToRefresh>
    );
  }

  return (
    <div
      className={`h-full min-h-0 overflow-y-auto overflow-x-hidden scroll-smooth ${className}`}
    >
      {children}
    </div>
  );
}

export const PULL_REFRESH_EVENT = 'alphaclone-pull-refresh';

export function dispatchPullRefresh(path: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(PULL_REFRESH_EVENT, { detail: { path } }),
  );
}

/** Re-run tab data loaders when the user pull-refreshes the dashboard shell. */
export function usePullToRefreshListener(
  onRefresh: () => void | Promise<void>,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = () => {
      void onRefresh();
    };
    window.addEventListener(PULL_REFRESH_EVENT, handler);
    return () => window.removeEventListener(PULL_REFRESH_EVENT, handler);
  }, [onRefresh, enabled]);
}
