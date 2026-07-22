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

    // Landing / booking / meet are always marketing shell — skip PWA splash for faster access.
    if (!isPWA && (pathname === '/' || pathname?.startsWith('/book') || pathname?.startsWith('/meet'))) {
        return <MarketingShell>{children}</MarketingShell>;
    }

    if (isLoading) {
        return <Splash />;
    }

    if (isPWA) {
        return <AppShell>{children}</AppShell>;
    }

    // Install banner lives once in root layout (PwaInstallPrompt) — do not mount a second nudge here.
    return <MarketingShell>{children}</MarketingShell>;
}
