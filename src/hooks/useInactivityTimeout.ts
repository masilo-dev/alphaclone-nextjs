import { useEffect, useRef } from 'react';

/**
 * Hook to detect user inactivity and trigger a callback after a specified timeout
 * @param onTimeout - Callback function to execute when timeout is reached
 * @param timeoutMs - Timeout duration in milliseconds (default: 10 minutes)
 * @param enabled - Whether the hook is active (default: true)
 */
export function useInactivityTimeout(
    onTimeout: () => void,
    timeoutMs: number = 10 * 60 * 1000, // 10 minutes
    enabled: boolean = true
) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const onTimeoutRef = useRef(onTimeout);

    // Keep callback ref updated
    useEffect(() => {
        onTimeoutRef.current = onTimeout;
    }, [onTimeout]);

    useEffect(() => {
        if (!enabled) {
            // Clear any existing timeout if disabled
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            return;
        }

        const resetTimer = () => {
            // Clear existing timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Set new timeout
            timeoutRef.current = setTimeout(() => {
                onTimeoutRef.current();
            }, timeoutMs);
        };

        // Activity event handlers
        const events = [
            'mousedown',
            'mousemove',
            'keypress',
            'scroll',
            'touchstart',
            'click',
        ];

        // Reset timer on any activity
        events.forEach((event) => {
            document.addEventListener(event, resetTimer);
        });

        // Initialize timer
        resetTimer();

        // Cleanup
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            events.forEach((event) => {
                document.removeEventListener(event, resetTimer);
            });
        };
    }, [timeoutMs, enabled]);
}
