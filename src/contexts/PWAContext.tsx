'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { isPWA } from '@/utils/pwaUtils';

interface PWAContextType {
    isPWA: boolean;
    isLoading: boolean;
}

const PWAContext = createContext<PWAContextType>({ isPWA: false, isLoading: true });

export const PWAProvider = ({ children }: { children: React.ReactNode }) => {
    const [isPwaMode, setIsPwaMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check immediately on mount
        const checkPWA = () => {
            const pwaStatus = isPWA();
            setIsPwaMode(pwaStatus);
            setIsLoading(false);
        };

        checkPWA();

        // Optional: Listen for changes if display mode changes dynamically (rare but good for dev)
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleChange = (e: MediaQueryListEvent) => {
            // recheck everything effectively
            setIsPwaMode(e.matches || isPWA());
        };

        // safe addEventListener check for older browsers not strictly needed for modern PWA but good practice
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, []);

    return (
        <PWAContext.Provider value={{ isPWA: isPwaMode, isLoading }}>
            {children}
        </PWAContext.Provider>
    );
};

export const usePWA = () => useContext(PWAContext);
