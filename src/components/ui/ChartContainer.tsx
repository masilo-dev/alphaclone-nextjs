'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ChartContainerProps {
    children: React.ReactNode;
    className?: string;
    minHeight?: number;
}

/**
 * ChartContainer - Wraps Recharts components to prevent dimension errors
 *
 * Solves: "The width(-1) and height(-1) of chart should be greater than 0"
 *
 * This component ensures charts only render after:
 * 1. Component has mounted (client-side only)
 * 2. Container has valid dimensions
 */
export const ChartContainer: React.FC<ChartContainerProps> = ({
    children,
    className = 'h-[300px]',
    minHeight = 300
}) => {
    const [isMounted, setIsMounted] = useState(false);
    const [hasSize, setHasSize] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsMounted(true);

        // Check if container has dimensions
        const checkSize = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                if (width > 0 && height > 0) {
                    setHasSize(true);
                }
            }
        };

        // Check immediately
        checkSize();

        // Also check after a short delay (for lazy-loaded tabs)
        const timer = setTimeout(checkSize, 100);

        // Listen for resize events
        window.addEventListener('resize', checkSize);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', checkSize);
        };
    }, []);

    if (!isMounted || !hasSize) {
        return (
            <div ref={containerRef} className={className} style={{ minHeight }}>
                <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className={className} style={{ minHeight }}>
            {children}
        </div>
    );
};

export default ChartContainer;
