import { useState, useEffect, useCallback, useRef } from 'react';

interface SwipeHandlers {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
}

interface SwipeConfig {
    minSwipeDistance?: number;
    maxSwipeTime?: number;
}

export function useSwipeGesture(
    handlers: SwipeHandlers,
    config: SwipeConfig = {}
) {
    const { minSwipeDistance = 50, maxSwipeTime = 300 } = config;
    const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        touchStart.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
        };
    }, []);

    const onTouchEnd = useCallback(
        (e: React.TouchEvent) => {
            if (!touchStart.current) return;

            const touch = e.changedTouches[0];
            if (!touch) return;
            const deltaX = touch.clientX - touchStart.current.x;
            const deltaY = touch.clientY - touchStart.current.y;
            const deltaTime = Date.now() - touchStart.current.time;

            if (deltaTime > maxSwipeTime) {
                touchStart.current = null;
                return;
            }

            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);

            if (absX > absY && absX > minSwipeDistance) {
                // Horizontal swipe
                if (deltaX > 0) {
                    handlers.onSwipeRight?.();
                } else {
                    handlers.onSwipeLeft?.();
                }
            } else if (absY > absX && absY > minSwipeDistance) {
                // Vertical swipe
                if (deltaY > 0) {
                    handlers.onSwipeDown?.();
                } else {
                    handlers.onSwipeUp?.();
                }
            }

            touchStart.current = null;
        },
        [handlers, minSwipeDistance, maxSwipeTime]
    );

    return { onTouchStart, onTouchEnd };
}

// Hook for pull-to-refresh
export function usePullToRefresh(onRefresh: () => Promise<void>) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef(0);
    const currentY = useRef(0);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (window.scrollY === 0) {
            const touch = e.touches[0];
            if (touch) startY.current = touch.clientY;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (window.scrollY === 0 && startY.current > 0) {
            const touch = e.touches[0];
            if (touch) currentY.current = touch.clientY;
            const pullDistance = currentY.current - startY.current;

            if (pullDistance > 80 && !isRefreshing) {
                setIsRefreshing(true);
                onRefresh().finally(() => {
                    setIsRefreshing(false);
                    startY.current = 0;
                    currentY.current = 0;
                });
            }
        }
    };

    const handleTouchEnd = () => {
        startY.current = 0;
        currentY.current = 0;
    };

    return {
        isRefreshing,
        pullToRefreshHandlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
        },
    };
}

// Hook for responsive breakpoints
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const media = window.matchMedia(query);
        setMatches(media.matches);

        const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
        media.addEventListener('change', listener);

        return () => media.removeEventListener('change', listener);
    }, [query]);

    return matches;
}

// Predefined breakpoint hooks
export const useIsMobile = () => useMediaQuery('(max-width: 768px)');
export const useIsTablet = () => useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1025px)');

export default useSwipeGesture;
