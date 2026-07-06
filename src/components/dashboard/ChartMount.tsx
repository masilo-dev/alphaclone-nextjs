'use client';

import React, { useEffect, useState } from 'react';

interface ChartMountProps {
  height?: number;
  children: React.ReactNode;
}

/** Recharts needs a mounted client layout with explicit height. */
export function ChartMount({ height = 240, children }: ChartMountProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="w-full rounded-lg dashboard-panel-soft animate-pulse" style={{ height }} />;
  }

  return (
    <div className="w-full" style={{ height, minHeight: height }}>
      {children}
    </div>
  );
}
