'use client';

import React from 'react';

interface ChartMountProps {
  height?: number;
  children: React.ReactNode;
}

/** Recharts needs explicit height — render immediately (no extra paint delay). */
export function ChartMount({ height = 240, children }: ChartMountProps) {
  return (
    <div className="w-full min-w-0 overflow-hidden" style={{ height, minHeight: height }}>
      {children}
    </div>
  );
}
