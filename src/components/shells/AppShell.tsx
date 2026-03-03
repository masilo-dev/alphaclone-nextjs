'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Splash from '@/components/pwa/Splash';

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isRedirecting, setIsRedirecting] = useState(false);

    useEffect(() => {
        // If auth is still loading, do nothing
        if (authLoading) return;

        const handleRedirection = async () => {
            if (!user) {
                // Not authenticated
                if (pathname !== '/auth/login' && !pathname.startsWith('/auth/')) {
                    console.log('AppShell: No user, redirecting to login');
                    setIsRedirecting(true);
                    await router.replace('/auth/login');
                } else {
                    setIsRedirecting(false);
                }
            } else {
                // Authenticated
                // Prevent access to landing page (root) and login page in PWA mode
                if (pathname === '/' || pathname === '/auth/login') {
                    console.log('AppShell: Logged in, redirecting to dashboard');
                    setIsRedirecting(true);
                    await router.replace('/dashboard');
                } else {
                    // We are where we should be
                    setIsRedirecting(false);
                }
            }
        };

        handleRedirection();
    }, [user, authLoading, pathname, router]);

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
