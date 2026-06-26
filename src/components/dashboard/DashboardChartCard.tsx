'use client';

import React from 'react';

interface DashboardChartCardProps {
  children: React.ReactNode;
  className?: string;
}

export function DashboardChartCard({ children, className = '' }: DashboardChartCardProps) {
  return (
    <div className={`bg-surface-1 rounded-lg p-4 min-h-[240px] ${className}`}>{children}</div>
  );
}
