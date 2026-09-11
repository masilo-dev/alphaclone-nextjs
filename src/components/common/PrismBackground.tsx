'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

/**
 * PrismBackground
 * Shared animated background used across all marketing pages.
 * Renders two slow-drifting gradient orbs (teal + blue) on a dark slate base,
 * with a subtle grid overlay — matching the LandingPage hero aesthetic.
 */
const PrismBackground = React.memo(() => {
    const pathname = usePathname();

    // Exclude background from app workflows where readability is critical.
    if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/contract/')) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
            aria-hidden="true"
            style={{ contain: 'layout style paint' }}
        >
            {/* Base image background shared across marketing pages */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-42"
                style={{ backgroundImage: "url('/marketing-bg-v2.jpg')" }}
            />
            <div className="absolute inset-0 bg-slate-950/48" />

            {/* Very light atmospheric glow without motion */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.10),transparent_32%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_28%)]" />

            {/* Subtle grid pattern overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-6" />
        </div>
    );
});

PrismBackground.displayName = 'PrismBackground';

export default PrismBackground;
