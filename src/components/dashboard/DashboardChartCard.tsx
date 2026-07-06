'use client';

import React from 'react';
import { DashboardPanelHeader } from './DashboardPanelHeader';

interface DashboardChartCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}

export function DashboardChartCard({ children, className = '', title, subtitle }: DashboardChartCardProps) {
  return (
    <div className={`dashboard-panel rounded-2xl p-5 min-h-[280px] flex flex-col ${className}`}>
      {title ? <DashboardPanelHeader title={title} subtitle={subtitle} /> : null}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
