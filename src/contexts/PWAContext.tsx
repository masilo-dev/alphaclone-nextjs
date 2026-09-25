'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { isPWA } from '@/utils/pwaUtils';
import { resolveAppSurface, type AppSurface } from '@/lib/pwa/appSurface';

export interface PWAContextType {
    isPWA: boolean;
    isLoading: boolean;
    appSurface: AppSurface;
    canInstall: boolean;
    isInstalled: boolean;
    isIOS: boolean;
    hasNativePrompt: boolean;
    promptInstall: () => Promise<{ success: boolean; outcome?: string }>;
}

const PWAContext = createContext<PWAContextType>({
    isPWA: false,
    isLoading: false,
    appSurface: 'browser',
    canInstall: false,
    isInstalled: false,
    isIOS: false,
    hasNativePrompt: false,
    promptInstall: async () => ({ success: false }),
});

function getAppSurface(pwaMode: boolean): AppSurface {
    if (!pwaMode || typeof window === 'undefined') return 'browser';
    return resolveAppSurface({
        isPwa: pwaMode,
        width: window.innerWidth,
        coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    });
}

function detectIsIOS(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

export const PWAProvider = ({ children }: { children: React.ReactNode }) => {
    const [isPwaMode, setIsPwaMode] = useState(false);
    const [appSurface, setAppSurface] = useState<AppSurface>('browser');
    const [isLoading, setIsLoading] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [canInstall, setCanInstall] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    // Register service worker in production
    useEffect(() => {
        if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') return;
        void import('@/lib/pwa/registerServiceWorker').then(({ registerServiceWorkerSafely }) => {
            void registerServiceWorkerSafely();
        });
    }, []);

    // Listen for installability heuristics and browser lifecycle events
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const pwaActive = isPWA();
        setIsPwaMode(pwaActive);
        setAppSurface(getAppSurface(pwaActive));
        setIsInstalled(pwaActive);

        const iosDevice = detectIsIOS();
        setIsIOS(iosDevice);

        if (!pwaActive && iosDevice) {
            // iOS Safari supports Add to Home Screen via share sheet
            setCanInstall(true);
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            (window as any).deferredPrompt = e;
            setDeferredPrompt(e);
            setCanInstall(true);
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setCanInstall(false);
            setDeferredPrompt(null);
            (window as any).deferredPrompt = null;
        };

        // If prompt was captured before this hook mounted
        if ((window as any).deferredPrompt) {
            setDeferredPrompt((window as any).deferredPrompt);
            setCanInstall(true);
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        const standaloneQuery = window.matchMedia('(display-mode: standalone)');
        const overlayQuery = window.matchMedia('(display-mode: window-controls-overlay)');
        const onDisplayModeChange = () => {
            const currentPwa = isPWA();
            setIsPwaMode(currentPwa);
            setIsInstalled(currentPwa);
            setAppSurface(getAppSurface(currentPwa));
            if (currentPwa) setCanInstall(false);
        };

        standaloneQuery.addEventListener?.('change', onDisplayModeChange);
        overlayQuery.addEventListener?.('change', onDisplayModeChange);
        window.addEventListener('resize', onDisplayModeChange, { passive: true });

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
            standaloneQuery.removeEventListener?.('change', onDisplayModeChange);
            overlayQuery.removeEventListener?.('change', onDisplayModeChange);
            window.removeEventListener('resize', onDisplayModeChange);
        };
    }, []);

    // Synchronize root HTML classes and dataset for PWA surface
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

    const promptInstall = useCallback(async (): Promise<{ success: boolean; outcome?: string }> => {
        const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPrompt : null);
        if (!promptEvent) {
            return { success: false, outcome: 'dismissed' };
        }
        try {
            await promptEvent.prompt();
            const choice = await promptEvent.userChoice;
            setDeferredPrompt(null);
            if (typeof window !== 'undefined') {
                (window as any).deferredPrompt = null;
            }
            if (choice?.outcome === 'accepted') {
                setIsInstalled(true);
                setCanInstall(false);
                return { success: true, outcome: 'accepted' };
            }
            return { success: false, outcome: choice?.outcome || 'dismissed' };
        } catch (err) {
            console.error('Error during PWA promptInstall:', err);
            return { success: false };
        }
    }, [deferredPrompt]);

    return (
        <PWAContext.Provider
            value={{
                isPWA: isPwaMode,
                isLoading,
                appSurface,
                canInstall,
                isInstalled,
                isIOS,
                hasNativePrompt: Boolean(deferredPrompt),
                promptInstall,
            }}
        >
            {children}
        </PWAContext.Provider>
    );
};

export const usePWA = () => useContext(PWAContext);
