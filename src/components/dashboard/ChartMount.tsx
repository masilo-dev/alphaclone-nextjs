'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ChartMountProps {
  height?: number;
  children: React.ReactNode;
  className?: string;
}

/**
 * Shared chart mount used by dashboard widgets.
 * Recharts requires positive width/height; this waits for client mount
 * and a measured non-zero container before painting children.
 */
export function ChartMount({ height = 240, children, className = '' }: ChartMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      const { width, height: h } = el.getBoundingClientRect();
      if (width > 0 && h > 0) setReady(true);
    };

    check();
    const t1 = window.setTimeout(check, 50);
    const t2 = window.setTimeout(check, 200);
    const t3 = window.setTimeout(check, 500);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => check());
      observer.observe(el);
    }

    window.addEventListener('resize', check);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      observer?.disconnect();
      window.removeEventListener('resize', check);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`w-full min-w-0 overflow-hidden ${className}`}
      style={{ height, minHeight: height }}
    >
      {ready ? (
        children
      ) : (
        <div className="flex h-full w-full items-center justify-center" aria-hidden>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-500/30 border-t-teal-500" />
        </div>
      )}
    </div>
  );
}
