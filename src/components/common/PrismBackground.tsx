'use client';

import React from 'react';

/**
 * PrismBackground
 * Shared animated background used across all marketing pages.
 * Renders two slow-drifting gradient orbs (teal + blue) on a dark slate base,
 * with a subtle grid overlay — matching the LandingPage hero aesthetic.
 */
const PrismBackground = React.memo(() => {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        // Defer animation start to avoid blocking first paint
        const timer = setTimeout(() => setMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div
            className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
            aria-hidden="true"
            style={{ contain: 'layout style paint' }}
        >
            {/* Base dark background */}
            <div className="absolute inset-0 bg-slate-950" />

            {/* Animated gradient orbs — deferred for performance */}
            {mounted && (
                <>
                    <div
                        className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-500/8 blur-[40px] md:blur-[80px] animate-blob mix-blend-screen will-change-transform transform-gpu"
                        style={{ animationDuration: '20s' }}
                    />
                    <div
                        className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-600/8 blur-[40px] md:blur-[80px] animate-blob mix-blend-screen will-change-transform transform-gpu"
                        style={{ animationDelay: '6s', animationDuration: '25s' }}
                    />
                </>
            )}

            {/* Subtle grid pattern overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10" />
        </div>
    );
});

PrismBackground.displayName = 'PrismBackground';

export default PrismBackground;
