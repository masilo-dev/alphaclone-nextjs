'use client';

import React, { useEffect, useCallback } from 'react';

/**
 * NativeInteractions component
 * Provides a haptic feedback and active state proxy for the entire app.
 */
export default function NativeInteractions() {

    const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') => {
        if (typeof window === 'undefined' || !window.navigator.vibrate) return;

        switch (type) {
            case 'light':
                window.navigator.vibrate(10);
                break;
            case 'medium':
                window.navigator.vibrate(20);
                break;
            case 'heavy':
                window.navigator.vibrate(40);
                break;
            case 'success':
                window.navigator.vibrate([10, 30, 10]);
                break;
            case 'error':
                window.navigator.vibrate([50, 50, 50]);
                break;
        }
    }, []);

    useEffect(() => {
        const handleInteraction = (e: MouseEvent | TouchEvent) => {
            // Synthetic/programmatic events do not grant browser user
            // activation and Chrome rejects vibration attempted from them.
            if (!e.isTrusted || !navigator.userActivation?.isActive) return;
            const target = e.target as HTMLElement;
            const interactive = target.closest('button, a, [role="button"]');

            if (interactive) {
                // If it's a touch start, we trigger light haptic
                if (e.type === 'touchstart') {
                    triggerHaptic('light');
                }
            }
        };

        window.addEventListener('touchstart', handleInteraction as any, { passive: true });

        return () => {
            window.removeEventListener('touchstart', handleInteraction as any);
        };
    }, [triggerHaptic]);

    return null; // This is a utility component
}
