'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

/**
 * Root marketing pass-through shell.
 *
 * IMPORTANT: Do not use nested `fixed + overflow-y-auto` scrollports here.
 * That pattern traps scroll inside a child layer, breaks sticky/fixed headers,
 * and can paint duplicated chrome while scrolling.
 *
 * Page-level chrome (header/footer) lives in
 * `src/components/marketing/system/MarketingShell.tsx`.
 */
export default function MarketingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isDashboardOrApp =
    pathname?.startsWith('/dashboard') ||
    pathname?.startsWith('/auth') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/account') ||
    pathname?.startsWith('/billing') ||
    pathname?.startsWith('/contract') ||
    pathname?.startsWith('/project') ||
    pathname?.startsWith('/invoice') ||
    pathname?.startsWith('/form') ||
    pathname?.startsWith('/portal') ||
    pathname?.startsWith('/private-docs') ||
    pathname?.startsWith('/p/') ||
    pathname?.startsWith('/bp/');

  if (isDashboardOrApp) {
    return <div className="ac-business-root min-h-screen">{children}</div>;
  }

  return (
    <div className="marketing-theme min-h-screen">
      {children}
    </div>
  );
}
