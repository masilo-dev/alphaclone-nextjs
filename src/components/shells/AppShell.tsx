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

        if (!user) {
            // Not authenticated
            if (pathname !== '/auth/login') {
                setIsRedirecting(true);
                router.replace('/auth/login');
            } else {
                setIsRedirecting(false);
            }
        } else {
            // Authenticated
            // Prevent access to landing page (root) and login page
            if (pathname === '/' || pathname === '/auth/login') {
                setIsRedirecting(true);
                router.replace('/dashboard');
            } else {
                setIsRedirecting(false);
            }
        }
    }, [user, authLoading, pathname, router]);

    // Show splash during auth load or redirection logic
    if (authLoading || isRedirecting) {
        return <Splash />;
    }

    // If we are on the landing page but haven't redirected yet (edge case), show Splash
    // This prevents the landing page from flashing
    if (pathname === '/' && user) return <Splash />;
    if (pathname === '/' && !user) return <Splash />; // Will redirect to login

    // "PWA Mode" layout - Minimal, no browser UI interference
    return (
        <div className="flex flex-col h-screen w-screen bg-[#050B1E] overflow-hidden overscroll-none text-white">
            {/* 
         Here we could add a PWA-specific top bar or navigation if needed for the 'App' 
         For now, we render children (Dashboard or Login) 
       */}
            <div className="flex-1 overflow-auto">
                {children}
            </div>
        </div>
    );
}
