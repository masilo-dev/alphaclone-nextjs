'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Providers } from '@/components/Providers';
import { MarketingProviders } from '@/components/MarketingProviders';
import { isAppShellRoute, isPublicMarketingRoute } from '@/lib/isPublicMarketingRoute';

export function ProviderSwitcher({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isAppShellRoute(pathname)) {
    return <Providers>{children}</Providers>;
  }

  if (isPublicMarketingRoute(pathname)) {
    return <MarketingProviders>{children}</MarketingProviders>;
  }

  // Legacy / mixed routes (e.g. tools) — full stack for safety.
  return <Providers>{children}</Providers>;
}
