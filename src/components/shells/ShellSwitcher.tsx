'use client';

import React from 'react';
import { usePWA } from '@/contexts/PWAContext';
import MarketingShell from './MarketingShell';
import AppShell from './AppShell';
import Splash from '@/components/pwa/Splash';

import { usePathname } from 'next/navigation';
import { isPublicMarketingRoute } from '@/lib/isPublicMarketingRoute';

export default function ShellSwitcher({ children }: { children: React.ReactNode }) {
    const { isPWA, isLoading } = usePWA();
    const pathname = usePathname();

    const isPublicRoute = isPublicMarketingRoute(pathname);

    if (!isPWA && isPublicRoute) {
        return <MarketingShell>{children}</MarketingShell>;
    }

    if (isLoading && isPWA) {
        return <Splash />;
    }

    if (isPWA) {
        return <AppShell>{children}</AppShell>;
    }

    // Install banner lives once in root layout (PwaInstallPrompt) — do not mount a second nudge here.
    return <MarketingShell>{children}</MarketingShell>;
}
