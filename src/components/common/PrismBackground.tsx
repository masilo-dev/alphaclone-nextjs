'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

/**
 * Clean solid marketing canvas — no photo / stock / AI background imagery.
 */
const PrismBackground = React.memo(() => {
  const pathname = usePathname();

  if (
    pathname?.startsWith('/dashboard') ||
    pathname?.startsWith('/contract/') ||
    pathname?.startsWith('/auth')
  ) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#041027]"
      aria-hidden="true"
    />
  );
});

PrismBackground.displayName = 'PrismBackground';

export default PrismBackground;
