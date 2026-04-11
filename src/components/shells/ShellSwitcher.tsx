'use client';

import React from 'react';
import { usePWA } from '@/contexts/PWAContext';
import MarketingShell from './MarketingShell';
import AppShell from './AppShell';
import Splash from '@/components/pwa/Splash';
import PwaInstallNudge from '@/components/common/PwaInstallNudge';

import { usePathname } from 'next/navigation';

const isDev = process.env.NODE_ENV === 'development';

export default function ShellSwitcher({ children }: { children: React.ReactNode }) {
    const { isPWA, isLoading } = usePWA();
    const pathname = usePathname();

    // optimization: Landing page and Booking pages are always "Marketing/Web" mode.
    // Bypass PWA Loading/Splash screen completely for faster generic user access, 
    // unless we are specifically in PWA mode (where we want the branded splash).
    if (!isPWA && (pathname === '/' || pathname?.startsWith('/book') || pathname?.startsWith('/meet'))) {
        return <MarketingShell>{children}</MarketingShell>;
    }

    if (isLoading) {
        if (isDev) console.log('[ShellSwitcher] Waiting for PWA status check...');
        return <Splash />;
    }

    if (isDev) console.log('[ShellSwitcher] Shell decision:', { isPWA, pathname });

    if (isPWA) {
        return <AppShell>{children}</AppShell>;
    }

    return (
        <MarketingShell>
            {children}
            <PwaInstallNudge />
        </MarketingShell>
    );
}
