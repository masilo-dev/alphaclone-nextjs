'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

/**
 * Clean solid marketing canvas — no photo / stock / AI background imagery.
 */
const PrismBackground = React.memo(() => {
  const pathname = usePathname();

  if (
    pathname?.startsWith('/dashboard') ||
    pathname?.startsWith('/contract/') ||
    pathname?.startsWith('/auth')
  ) {
    return null;
  }

<<<<<<< HEAD
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#041027]"
      aria-hidden="true"
    />
  );
=======
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
                className="absolute inset-0 bg-cover bg-center opacity-58"
                style={{ backgroundImage: "url('/marketing-bg-v2.jpg')" }}
            />
            <div className="absolute inset-0 bg-slate-950/38" />

            {/* Animated gradient orbs — deferred for performance */}
            {mounted && (
                <>
                    <div
                        className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-400/12 blur-[40px] md:blur-[80px] animate-blob mix-blend-screen will-change-transform transform-gpu"
                        style={{ animationDuration: '20s' }}
                    />
                    <div
                        className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-500/12 blur-[40px] md:blur-[80px] animate-blob mix-blend-screen will-change-transform transform-gpu"
                        style={{ animationDelay: '6s', animationDuration: '25s' }}
                    />
                </>
            )}

            {/* Subtle grid pattern overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10" />
        </div>
    );
>>>>>>> origin/main
});

PrismBackground.displayName = 'PrismBackground';

export default PrismBackground;
