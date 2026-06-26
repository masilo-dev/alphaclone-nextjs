import React from 'react';

interface ModuleDashboardLayoutProps {
  row1: React.ReactNode;
  row2: React.ReactNode;
  row3: React.ReactNode;
  row1Extra?: React.ReactNode;
}

export function ModuleDashboardLayout({ row1, row1Extra, row2, row3 }: ModuleDashboardLayoutProps) {
  return (
    <div className="space-y-4 md:space-y-5 p-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{row1}</div>
      {row1Extra ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{row1Extra}</div>
      ) : null}
      <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-4 md:gap-5">{row2}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">{row3}</div>
    </div>
  );
}
