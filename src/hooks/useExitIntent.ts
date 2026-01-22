import { useState, useEffect, useCallback } from 'react';
import { isPWA } from '../utils/exitIntentUtils';

/**
 * Exit-Intent Detection Hook
 * 
 * Detects when user is about to leave the page:
 * - Mouse leaving viewport (desktop)
 * - Back navigation intent
 * 
 * Does NOT trigger:
 * - In PWA mode
 * - On mobile scroll
 * - During normal navigation
 */
export const useExitIntent = () => {
    const [exitIntentTriggered, setExitIntentTriggered] = useState(false);
    const [hasTriggered, setHasTriggered] = useState(false);

    const handleMouseLeave = useCallback((e: MouseEvent) => {
        // Only trigger if mouse leaves from the top of the viewport
        // This prevents triggering on normal scrolling or side navigation
        if (e.clientY <= 0 && !hasTriggered) {
            setExitIntentTriggered(true);
            setHasTriggered(true);
        }
    }, [hasTriggered]);

    const handleBeforeUnload = useCallback(() => {
        if (!hasTriggered) {
            setExitIntentTriggered(true);
            setHasTriggered(true);
        }
    }, [hasTriggered]);

    useEffect(() => {
        // Never run in PWA mode
        if (isPWA()) {
            return;
        }

        // Only run on desktop (not mobile)
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
            return;
        }

        // Add event listeners
        document.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            document.removeEventListener('mouseleave', handleMouseLeave);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [handleMouseLeave, handleBeforeUnload]);

    const resetTrigger = useCallback(() => {
        setExitIntentTriggered(false);
    }, []);

    return {
        exitIntentTriggered,
        resetTrigger
    };
};
