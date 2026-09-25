'use client';

import React from 'react';
import { usePWA } from '@/contexts/PWAContext';
import MarketingShell from './MarketingShell';
import AppShell from './AppShell';
import Splash from '@/components/pwa/Splash';

import { usePathname } from 'next/navigation';

export default function ShellSwitcher({ children }: { children: React.ReactNode }) {
    const { isPWA, isLoading } = usePWA();
    const pathname = usePathname();

    const isPublicRoute =
        !pathname ||
        pathname === '/' ||
        pathname.startsWith('/about') ||
        pathname.startsWith('/pricing') ||
        pathname.startsWith('/faq') ||
        pathname.startsWith('/book') ||
        pathname.startsWith('/meet') ||
        pathname.startsWith('/who-we-serve') ||
        pathname.startsWith('/blog') ||
        pathname.startsWith('/contact') ||
        pathname.startsWith('/legal') ||
        pathname.startsWith('/privacy') ||
        pathname.startsWith('/terms') ||
        pathname.startsWith('/portal');

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
