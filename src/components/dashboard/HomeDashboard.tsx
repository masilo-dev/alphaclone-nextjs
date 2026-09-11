'use client';

import { OverviewDashboard } from '@/components/dashboard/views/ModuleDashboardView';

/** @deprecated Use OverviewDashboard via BusinessHome or Dashboard default route. */
export default function HomeDashboard() {
  return <OverviewDashboard />;
}
