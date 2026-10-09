'use client';

import type { ReactNode } from 'react';

/**
 * DashboardRouteTransition provides a stable, zero-overhead layout wrapper
 * across authenticated module navigations.
 *
 * It avoids unmounting or flashing opacity when navigating between
 * cached, persistent application shell modules.
 */
export function DashboardRouteTransition({
  routeKey,
  children,
  className,
}: {
  routeKey: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-route-key={routeKey}
      className={className}
    >
      {children}
    </div>
  );
}
