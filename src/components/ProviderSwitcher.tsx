'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { MarketingProviders } from '@/components/MarketingProviders';
import { isAppShellRoute, isPublicMarketingRoute } from '@/lib/isPublicMarketingRoute';

// Load the full authenticated provider stack only for routes that need it.
const Providers = dynamic(() => import('@/components/Providers').then((module) => module.Providers));

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
