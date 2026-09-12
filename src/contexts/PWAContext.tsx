'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { isPWA } from '@/utils/pwaUtils';

type AppSurface = 'browser' | 'pwa-mobile' | 'pwa-tablet' | 'pwa-desktop';

interface PWAContextType {
    isPWA: boolean;
    isLoading: boolean;
    appSurface: AppSurface;
}

const PWAContext = createContext<PWAContextType>({ isPWA: false, isLoading: true, appSurface: 'browser' });

function getAppSurface(pwaMode: boolean): AppSurface {
    if (!pwaMode || typeof window === 'undefined') return 'browser';
    const width = window.innerWidth;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (width < 768) return 'pwa-mobile';
    if (width < 1100 && coarse) return 'pwa-tablet';
    return 'pwa-desktop';
}

export const PWAProvider = ({ children }: { children: React.ReactNode }) => {
    // Keep the server render and the first client render identical. Reading
    // display-mode during state initialization made installed windows render an
    // AppShell while the server rendered a MarketingShell, causing hydration
    // error #418 and leaving the full-screen splash mounted during recovery.
    const [isPwaMode, setIsPwaMode] = useState(false);
    const [appSurface, setAppSurface] = useState<AppSurface>('browser');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_ENABLE_SERWIST !== 'true' && process.env.NEXT_PUBLIC_ENABLE_PWA !== 'true') {
            const key = 'alphaclone_sw_unregistered';
            if (!sessionStorage.getItem(key)) {
                void navigator.serviceWorker?.getRegistrations?.().then((regs) => {
                    if (regs && regs.length > 0) regs.forEach((r) => void r.unregister());
                    sessionStorage.setItem(key, 'true');
                });
            }
        }
    }, []);

    useEffect(() => {
        const syncEnvironment = () => {
            const pwaStatus = isPWA();
            setIsPwaMode(pwaStatus);
            setAppSurface(getAppSurface(pwaStatus));
            setIsLoading(false);
        };

        syncEnvironment();
        const standaloneQuery = window.matchMedia('(display-mode: standalone)');
        const overlayQuery = window.matchMedia('(display-mode: window-controls-overlay)');
        const onChange = () => syncEnvironment();

        standaloneQuery.addEventListener?.('change', onChange);
        overlayQuery.addEventListener?.('change', onChange);
        window.addEventListener('resize', onChange, { passive: true });

        return () => {
            standaloneQuery.removeEventListener?.('change', onChange);
            overlayQuery.removeEventListener?.('change', onChange);
            window.removeEventListener('resize', onChange);
        };
    }, []);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const root = document.documentElement;
        const classes = ['pwa-standalone', 'ac-pwa-mobile', 'ac-pwa-tablet', 'ac-pwa-desktop'];
        classes.forEach((name) => root.classList.remove(name));
        root.dataset.appSurface = appSurface;

        if (isPwaMode) {
            root.classList.add('pwa-standalone');
            if (appSurface === 'pwa-mobile') root.classList.add('ac-pwa-mobile');
            if (appSurface === 'pwa-tablet') root.classList.add('ac-pwa-tablet');
            if (appSurface === 'pwa-desktop') root.classList.add('ac-pwa-desktop');
        }

        return () => {
            classes.forEach((name) => root.classList.remove(name));
            delete root.dataset.appSurface;
        };
    }, [appSurface, isPwaMode]);

    return (
        <PWAContext.Provider value={{ isPWA: isPwaMode, isLoading, appSurface }}>
            {children}
        </PWAContext.Provider>
    );
};

export const usePWA = () => useContext(PWAContext);
