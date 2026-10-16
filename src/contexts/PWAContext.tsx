'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { installEventOwner, promptCapturedInstall } from '@/lib/pwa/installLifecycle';
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

        installEventOwner(window);
        const synchronizeInstall = () => {
            if (pwaActive) return;
            const current = installEventOwner(window);
            setDeferredPrompt(current.event);
            setIsInstalled(current.installed || isPWA());
            setCanInstall(!current.installed && !isPWA() && (Boolean(current.event) || iosDevice));
        };
        synchronizeInstall();
        window.addEventListener('ac:install-state', synchronizeInstall);

        const standaloneQuery = window.matchMedia('(display-mode: standalone)');
        const overlayQuery = window.matchMedia('(display-mode: window-controls-overlay)');
        const onDisplayModeChange = () => {
            const currentPwa = isPWA();
            setIsPwaMode(currentPwa);
            setIsInstalled(currentPwa);
            setAppSurface(getAppSurface(currentPwa));
            if (currentPwa) {
                setCanInstall(false);
                setDeferredPrompt(null);
            }
        };

        standaloneQuery.addEventListener?.('change', onDisplayModeChange);
        overlayQuery.addEventListener?.('change', onDisplayModeChange);
        window.addEventListener('resize', onDisplayModeChange, { passive: true });

        return () => {
            window.removeEventListener('ac:install-state', synchronizeInstall);
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
        if (typeof window === 'undefined') return { success: false, outcome: 'unavailable' };
        if (!installEventOwner(window).event) return { success: false, outcome: isIOS ? 'manual_install' : 'unavailable' };
        return promptCapturedInstall(window);
    }, [isIOS]);

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
