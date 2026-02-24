'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ExitIntentModal from '@/components/ExitIntentModal';
import { usePathname } from 'next/navigation';

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
                <div className="marketing-theme marketing-bg-grid relative overflow-hidden min-h-screen font-marketing-body text-slate-300">
                    <div className="marketing-glow-hero top-0 left-1/2"></div>
                    {children}
                </div>
            ) : (
                children
            )}
            <ExitIntentModal user={user} />
        </>
    );
}
