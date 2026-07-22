'use client';

import React from 'react';
import { BarChart3, TrendingUp, Zap, Bell } from 'lucide-react';
import HubShell from './HubShell';

const INSIGHTS_TABS = [
  { label: 'Executive', href: '/dashboard/executive', icon: BarChart3 },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Performance', href: '/dashboard/performance', icon: Zap },
  { label: 'Reports', href: '/dashboard/business/reports', icon: TrendingUp },
  { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
];

interface InsightsHubProps {
  children: React.ReactNode;
}

export default function InsightsHub({ children }: InsightsHubProps) {
  return (
    <HubShell
      title="Insights Hub"
      description="KPIs, performance metrics, and business reports"
      tabs={INSIGHTS_TABS}
      accent="teal"
    >
      {children}
    </HubShell>
  );
}
