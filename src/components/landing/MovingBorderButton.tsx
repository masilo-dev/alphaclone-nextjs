'use client';

import React from 'react';

interface MovingBorderButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    href?: string;
    ariaLabel?: string;
}

/**
 * Aceternity-style "Moving Border" CTA button.
 * Uses a conic-gradient mask animated via CSS custom property + keyframes.
 * No external library required.
 */
export function MovingBorderButton({
    children,
    onClick,
    className = '',
    ariaLabel,
}: MovingBorderButtonProps) {
    return (
        <button
            onClick={onClick}
            aria-label={ariaLabel || typeof children === 'string' ? String(children) : 'Action button'}
            className={`relative inline-flex items-center justify-center group ${className}`}
            style={{ padding: '2px', borderRadius: '12px' }}
        >
            {/* Spinning gradient border */}
            <span
                aria-hidden="true"
                className="absolute inset-0 rounded-[12px] overflow-hidden"
                style={{ zIndex: 0 }}
            >
                <span
                    className="absolute inset-[-150%] animate-moving-border"
                    style={{
                        background:
                            'conic-gradient(from 0deg, transparent 0deg, #0077FF 60deg, #00D2A0 120deg, transparent 180deg)',
                    }}
                />
            </span>

            {/* Inner fill */}
            <span
                className="relative z-10 flex items-center gap-2 rounded-[10px] bg-[#020D1A] px-8 py-4 text-base font-bold tracking-widest uppercase text-white transition-all duration-300 group-hover:bg-[#041626]"
                style={{ minWidth: '200px', justifyContent: 'center' }}
            >
                {children}
            </span>
        </button>
    );
}

export default MovingBorderButton;
