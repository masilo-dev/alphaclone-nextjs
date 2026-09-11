'use client';

import React from 'react';
import type { User } from '@/types';
import { TabSkeleton } from '@/components/ui/TabSkeleton';

const GoalsTab = React.lazy(() => import('@/components/dashboard/goals/GoalsTab'));
const JobsQueueTab = React.lazy(() => import('@/components/dashboard/jobs/JobsQueueTab'));
const VendorsTab = React.lazy(() => import('@/components/dashboard/vendors/VendorsTab'));
const WebhooksTab = React.lazy(() => import('@/components/dashboard/extensions/WebhooksTab'));
const AnnualPlanningTab = React.lazy(() => import('@/components/dashboard/planning/AnnualPlanningTab'));
const NotificationsActivityTab = React.lazy(() => import('@/components/dashboard/NotificationsActivityTab'));
const PlatformHelpTab = React.lazy(() => import('@/components/dashboard/help/PlatformHelpTab'));
const InvoicesTab = React.lazy(() => import('@/components/dashboard/invoicing/InvoicesTab'));

/** Routes that must resolve identically in Dashboard.tsx and BusinessDashboard.tsx */
export const SHARED_DASHBOARD_EXTENSION_ROUTES = [
  '/dashboard/goals',
  '/dashboard/planning',
  '/dashboard/jobs',
  '/dashboard/vendors',
  '/dashboard/webhooks',
  '/dashboard/notifications',
  '/dashboard/help',
  '/dashboard/business/invoices',
] as const;

export type SharedDashboardExtensionRoute = (typeof SHARED_DASHBOARD_EXTENSION_ROUTES)[number];

export function isSharedDashboardExtensionRoute(route: string): route is SharedDashboardExtensionRoute {
  return (SHARED_DASHBOARD_EXTENSION_ROUTES as readonly string[]).includes(route);
}

/**
 * Renders extension routes shared by platform and tenant-admin shells.
 * Returns null when the route is not handled here.
 */
export function renderSharedDashboardRoute(route: string, user: User): React.ReactNode | null {
  switch (route) {
    case '/dashboard/goals':
      return (
        <React.Suspense fallback={<TabSkeleton />}>
          <GoalsTab />
        </React.Suspense>
      );
    case '/dashboard/planning':
      return (
        <React.Suspense fallback={<TabSkeleton />}>
          <AnnualPlanningTab />
        </React.Suspense>
      );
    case '/dashboard/jobs':
      return (
        <React.Suspense fallback={<TabSkeleton />}>
          <JobsQueueTab />
        </React.Suspense>
      );
    case '/dashboard/vendors':
      return (
        <React.Suspense fallback={<TabSkeleton />}>
          <VendorsTab />
        </React.Suspense>
      );
    case '/dashboard/webhooks':
      return (
        <React.Suspense fallback={<TabSkeleton />}>
          <WebhooksTab />
        </React.Suspense>
      );
    case '/dashboard/notifications':
      return (
        <React.Suspense fallback={<TabSkeleton />}>
          <NotificationsActivityTab user={user} />
        </React.Suspense>
      );
    case '/dashboard/help':
      return (
        <React.Suspense fallback={<TabSkeleton />}>
          <PlatformHelpTab />
        </React.Suspense>
      );
    case '/dashboard/business/invoices':
      return (
        <React.Suspense fallback={<TabSkeleton />}>
          <InvoicesTab />
        </React.Suspense>
      );
    default:
      return null;
  }
}
