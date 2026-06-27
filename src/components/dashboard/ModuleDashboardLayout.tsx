import React from 'react';
import { ENTERPRISE } from '@/constants/design';
import { cn } from '@/lib/utils';

interface ModuleDashboardLayoutProps {
  row1: React.ReactNode;
  row2: React.ReactNode;
  row3: React.ReactNode;
  row1Extra?: React.ReactNode;
  className?: string;
}

export function ModuleDashboardLayout({
  row1,
  row1Extra,
  row2,
  row3,
  className,
}: ModuleDashboardLayoutProps) {
  return (
    <div className={cn(ENTERPRISE.moduleLayout.sectionGap, 'p-1 ac-scroll-full', className)}>
      <div className={ENTERPRISE.moduleLayout.summaryGrid}>{row1}</div>
      {row1Extra ? (
        <div className={ENTERPRISE.moduleLayout.summaryGrid}>{row1Extra}</div>
      ) : null}
      <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-4 md:gap-6">{row2}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">{row3}</div>
    </div>
  );
}
