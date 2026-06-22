'use client';

import dynamic from 'next/dynamic';
import { DashboardShellSkeleton } from '@/components/ui/TabSkeleton';

const DashboardHome = dynamic(() => import('@/components/dashboard/HomeDashboard'), {
  ssr: false,
  loading: () => <DashboardShellSkeleton />,
});

export default function DashboardPage() {
  return <DashboardHome />;
}
