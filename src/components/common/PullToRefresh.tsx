'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: React.ReactNode;
    className?: string;
}

/**
 * PullToRefresh component
 * Implements a native-like pull-to-refresh interaction for mobile.
 */
export default function PullToRefresh({ onRefresh, children, className = '' }: PullToRefreshProps) {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const controls = useAnimation();

    const pullThreshold = 80;

    const handleTouchStart = (e: TouchEvent) => {
        if (isRefreshing) return;
        // Only allow pull if we are at the top of the container
        if (containerRef.current && containerRef.current.scrollTop === 0) {
            startY.current = e.touches[0].pageY;
        } else {
            startY.current = -1;
        }
    };

    const handleTouchMove = (e: TouchEvent) => {
        if (startY.current === -1 || isRefreshing) return;

        const currentY = e.touches[0].pageY;
        const diff = currentY - startY.current;

        if (diff > 0) {
            // Resistance formula
            const distance = Math.min(diff * 0.4, 150);
            setPullDistance(distance);

            // Prevent scrolling when pulling down
            if (e.cancelable) e.preventDefault();
        }
    };

    const handleTouchEnd = async () => {
        if (startY.current === -1 || isRefreshing) return;

        if (pullDistance >= pullThreshold) {
            setIsRefreshing(true);
            setPullDistance(60); // Maintain a smaller distance while refreshing

            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            setPullDistance(0);
        }

        startY.current = -1;
    };

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        el.addEventListener('touchstart', handleTouchStart, { passive: false });
        el.addEventListener('touchmove', handleTouchMove, { passive: false });
        el.addEventListener('touchend', handleTouchEnd);

        return () => {
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchmove', handleTouchMove);
            el.removeEventListener('touchend', handleTouchEnd);
        };
    }, [pullDistance, isRefreshing]);

    return (
        <div
            ref={containerRef}
            className={`relative overflow-y-auto app-viewport ios-scroll ${className}`}
        >
            {/* Refresh Indicator */}
            <motion.div
                animate={{
                    y: pullDistance - 40,
                    opacity: pullDistance > 20 ? 1 : 0,
                    rotate: isRefreshing ? 360 : pullDistance * 2
                }}
                transition={isRefreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : { type: 'spring', damping: 20 }}
                className="absolute top-0 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-700 p-2 rounded-full shadow-lg"
                style={{ originX: 0.5 }}
            >
                <RefreshCw
                    className={`w-5 h-5 ${isRefreshing ? 'text-blue-400' : 'text-slate-400'}`}
                />
            </motion.div>

            {/* Content Container */}
            <motion.div
                animate={{ y: pullDistance }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="min-h-full"
            >
                {children}
            </motion.div>
        </div>
    );
}
