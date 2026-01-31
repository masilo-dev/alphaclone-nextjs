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

    // optimization: Booking pages are always "Marketing/Web" mode.
    // Bypass PWA Loading/Splash screen completely for faster generic user access.
    if (pathname?.startsWith('/book') || pathname?.startsWith('/meet')) {
        return <MarketingShell>{children}</MarketingShell>;
    }

    if (isLoading) {
        // While checking PWA status, we can show a splash or a very minimal loading state.
        // Using Splash here might be aggressive for Web users, but 'isLoading' is very fast (local check).
        // Let's use a transparent or minimal state to avoid "flash of splash" for web users if possible?
        // User requested "Splash -> Auth -> App" for PWA.
        // Making web users wait 1ms is fine.
        // But honestly, isPWA defaults to false in context initially?
        // No, we set isLoading: true initially.

        // We'll show Splash. This ensures PWA users get that "Native Boot" feel immediately.
        // Web users might see a split second flash. To optimize for web, we could default to Web?
        // BUT user said "Decision happens BEFORE rendering pages" and "Prevent Landing Page in PWA".
        // So blocking is safer.
        return <Splash />;
    }

    if (isPWA) {
        return <AppShell>{children}</AppShell>;
    }

    return <MarketingShell>{children}</MarketingShell>;
}
