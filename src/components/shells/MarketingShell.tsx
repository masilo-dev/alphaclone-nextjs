'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ExitIntentModal from '@/components/ExitIntentModal';
import { usePathname } from 'next/navigation';
import PrismBackground from '@/components/common/PrismBackground';

export default function MarketingShell({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const pathname = usePathname();

    const isDashboardOrApp = pathname?.startsWith('/dashboard') ||
        pathname?.startsWith('/auth') ||
        pathname?.startsWith('/login') ||
        pathname?.startsWith('/register') ||
        pathname?.startsWith('/contract') ||
        pathname?.startsWith('/project') ||
        pathname?.startsWith('/invoice');

    // Pass-through shell for standard web users.
    // Exit-intent modal only shows on web (not PWA)
    return (
        <>
            {!isDashboardOrApp ? (
                <div className="marketing-theme relative min-h-screen font-marketing-body text-slate-300">
                    <PrismBackground />
                    <div className="relative z-10">
                        {children}
                    </div>
                </div>
            ) : (
                children
            )}
            <ExitIntentModal user={user} />
        </>
    );
}
