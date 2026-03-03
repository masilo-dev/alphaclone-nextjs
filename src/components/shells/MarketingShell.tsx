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
    // Exit-intent modal removed from here (only shows in dashboard)
    return (
        <>
            {!isDashboardOrApp ? (
                <div className="marketing-theme fixed inset-0 font-marketing-body text-slate-300 overflow-hidden w-full h-full bg-[#020617]">
                    <PrismBackground />
                    <div className="relative z-10 w-full h-full overflow-y-auto app-viewport ios-scroll">
                        {children}
                    </div>
                </div>
            ) : (
                children
            )}
        </>
    );
}
