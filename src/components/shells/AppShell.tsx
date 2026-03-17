'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Splash from '@/components/pwa/Splash';

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading, needsMfa } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isRedirecting, setIsRedirecting] = useState(false);

    useEffect(() => {
        // If auth is still loading, do nothing
        if (authLoading) return;

        const handleRedirection = async () => {
            if (!user) {
                // Not authenticated
                const isAuthCallback = typeof window !== 'undefined' && (
                    window.location.search.includes('code=') ||
                    window.location.pathname.includes('/auth/callback') ||
                    sessionStorage.getItem('auth_callback_in_progress') === 'true'
                );

                if (pathname !== '/auth/login' && !pathname.startsWith('/auth/') && !isAuthCallback) {
                    console.log('AppShell: No user and not in auth callback, redirecting to login');
                    setIsRedirecting(true);
                    await router.replace('/auth/login');
                } else {
                    setIsRedirecting(false);
                }
            } else {
                // Authenticated — needsMfa already available from top-level useAuth()
                if (needsMfa && pathname !== '/auth/login' && !pathname.startsWith('/auth/')) {
                    console.log('AppShell: MFA required, redirecting to login challenge');
                    setIsRedirecting(true);
                    await router.replace('/auth/login?reason=mfa_required');
                    return;
                }

                // Prevent access to landing page (root) and login page in PWA mode
                // UNLESS needsMfa is true (in which case we stay on login for the challenge)
                if ((pathname === '/' || pathname === '/auth/login') && !needsMfa) {
                    console.log('AppShell: Logged in and MFA satisfied, redirecting to dashboard');
                    setIsRedirecting(true);
                    await router.replace('/dashboard');
                } else {
                    // We are where we should be
                    setIsRedirecting(false);
                }
            }
        };

        handleRedirection();
    }, [user, authLoading, needsMfa, pathname, router]);

    // Show splash during initial auth load OR while redirecting
    if (authLoading || isRedirecting) {
        return <Splash />;
    }

    return (
        <div className="flex flex-col h-screen w-screen bg-[#020617] overflow-hidden overscroll-none text-white fixed inset-0">
            {/* 
         Here we could add a PWA-specific top bar or navigation if needed for the 'App' 
         For now, we render children (Dashboard or Login) 
       */}
            <div className="flex-1 overflow-y-auto app-viewport ios-scroll">
                {children}
            </div>
        </div>
    );
}
