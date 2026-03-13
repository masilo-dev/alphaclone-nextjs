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

    // optimization: Landing page and Booking pages are always "Marketing/Web" mode.
    // Bypass PWA Loading/Splash screen completely for faster generic user access.
    if (pathname === '/' || pathname?.startsWith('/book') || pathname?.startsWith('/meet')) {
        return <MarketingShell>{children}</MarketingShell>;
    }

    if (isLoading) {
        console.log('[ShellSwitcher] Waiting for PWA status check...');
        return <Splash />;
    }

    console.log('[ShellSwitcher] Shell decision:', { isPWA, pathname });

    if (isPWA) {
        return <AppShell>{children}</AppShell>;
    }

    return <MarketingShell>{children}</MarketingShell>;
}
