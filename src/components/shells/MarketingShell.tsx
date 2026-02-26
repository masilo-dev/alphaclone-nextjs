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
                    {/* Ambient background orbs — teal & blue, matching LandingPage */}
                    <div
                        className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-500/8 blur-[80px] animate-blob mix-blend-screen pointer-events-none z-0"
                        style={{ animationDuration: '20s' }}
                        aria-hidden="true"
                    />
                    <div
                        className="fixed top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-600/8 blur-[80px] animate-blob mix-blend-screen pointer-events-none z-0"
                        style={{ animationDelay: '6s', animationDuration: '25s' }}
                        aria-hidden="true"
                    />
                    {/* Subtle grid overlay */}
                    <div
                        className="fixed inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.07] pointer-events-none z-0"
                        aria-hidden="true"
                    />
                    {children}
                </div>
            ) : (
                children
            )}
            <ExitIntentModal user={user} />
        </>
    );
}
