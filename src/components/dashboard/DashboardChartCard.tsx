'use client';

import React from 'react';
import { WORKSPACE } from '@/constants/design';
import { DashboardPanelHeader } from './DashboardPanelHeader';

interface DashboardChartCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}

export function DashboardChartCard({ children, className = '', title, subtitle }: DashboardChartCardProps) {
  return (
    <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.padding} min-h-[280px] flex flex-col shadow-none ${className}`}>
      {title ? <DashboardPanelHeader title={title} subtitle={subtitle} /> : null}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
