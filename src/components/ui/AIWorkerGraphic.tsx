'use client';

import React from 'react';
import { motion } from 'framer-motion';

/**
 * AIWorkerGraphic - A subtle, high-tech abstract animation
 * Representing an "AI at work" or "Jarvis" assistant.
 */
export const AIWorkerGraphic = () => {
    // Data Flow Particles - Generate stable random values to satisfy React purity rules
    const [particles, setParticles] = React.useState<any[]>([]);

    React.useEffect(() => {
        const newParticles = [...Array(12)].map((_, i) => ({
            id: i,
            r: 40 + Math.random() * 60,
            initialAngle: (i / 12) * Math.PI * 2,
            duration: 3 + Math.random() * 2,
            delay: i * 0.3
        }));
        setParticles(newParticles);
    }, []);

    return (
        <div className="relative w-full h-full flex items-center justify-center pointer-events-none select-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-transparent blur-3xl opacity-30" />
            
            <svg 
                viewBox="0 0 240 240" 
                className="w-full h-full max-w-md drop-shadow-[0_0_30px_rgba(20,184,166,0.3)]"
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Background Grid (HUD Style) */}
                <defs>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(20, 184, 166, 0.05)" strokeWidth="0.5"/>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Robotic "Construction" Arms */}
                {[0, 120, 240].map((angle, i) => (
                    <motion.g 
                        key={`arm-${i}`}
                        animate={{ rotate: [angle, angle + 360] }}
                        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                        style={{ originX: '120px', originY: '120px' }}
                    >
                        <motion.line 
                            x1="120" y1="120" x2="200" y2="120"
                            stroke="rgba(20, 184, 166, 0.15)"
                            strokeWidth="0.5"
                            strokeDasharray="4 4"
                        />
                        <motion.circle 
                            cx="200" cy="120" r="2"
                            fill="rgba(56, 189, 248, 0.4)"
                            animate={{ opacity: [0.2, 0.8, 0.2] }}
                            transition={{ duration: 2, repeat: Infinity, delay: i }}
                        />
                    </motion.g>
                ))}

                {/* Central Hub */}
                <motion.circle 
                    cx="120" cy="120" r="15" 
                    fill="url(#hubGradient)" 
                    animate={{ 
                        scale: [1, 1.15, 1],
                        filter: ["blur(0px)", "blur(4px)", "blur(0px)"]
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
                
                {/* Rotating HUD Rings */}
                <motion.circle 
                    cx="120" cy="120" r="50" 
                    stroke="rgba(20, 184, 166, 0.4)" 
                    strokeWidth="1.5" 
                    strokeDasharray="10 20"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                />
                <motion.circle 
                    cx="120" cy="120" r="70" 
                    stroke="rgba(56, 189, 248, 0.25)" 
                    strokeWidth="1" 
                    strokeDasharray="2 15"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                />
                
                {/* Scanning Arcs */}
                <motion.path 
                    d="M 80,120 A 40,40 0 0,1 160,120" 
                    stroke="rgba(20, 184, 166, 0.7)" 
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    animate={{ 
                        rotate: [0, 360],
                        opacity: [0.4, 0.9, 0.4]
                    }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    style={{ originX: '120px', originY: '120px' }}
                />

                {/* Data Flow Particles */}
                {particles.map((p) => (
                    (() => {
                        const startCx = 120 + Math.cos(p.initialAngle) * p.r;
                        const endCx = 120 + Math.cos(p.initialAngle) * (p.r * 0.2);
                        const startCy = 120 + Math.sin(p.initialAngle) * p.r;
                        const endCy = 120 + Math.sin(p.initialAngle) * (p.r * 0.2);
                        return (
                    <motion.circle
                        key={`p-${p.id}`}
                        cx={startCx}
                        cy={startCy}
                        r="1"
                        fill="rgba(56, 189, 248, 0.9)"
                        initial={{ cx: startCx, cy: startCy, opacity: 0, scale: 0.5 }}
                        animate={{
                            opacity: [0, 1, 0],
                            scale: [0.5, 1.2, 0.5],
                            cx: [startCx, endCx],
                            cy: [startCy, endCy],
                        }}
                        transition={{
                            duration: p.duration,
                            repeat: Infinity,
                            ease: "easeIn",
                            delay: p.delay
                        }}
                    />
                        );
                    })()
                ))}

                {/* Floating "Code" Snippets */}
                <motion.text
                    x="165" y="100"
                    fill="rgba(20, 184, 166, 0.3)"
                    fontSize="6"
                    className="font-mono"
                    animate={{ opacity: [0, 0.5, 0] }}
                    transition={{ duration: 5, repeat: Infinity }}
                >
                    INIT_PROCES...
                </motion.text>
                <motion.text
                    x="50" y="150"
                    fill="rgba(56, 189, 248, 0.3)"
                    fontSize="6"
                    className="font-mono"
                    animate={{ opacity: [0, 0.5, 0] }}
                    transition={{ duration: 5, repeat: Infinity, delay: 2.5 }}
                >
                    SYNC_LEADS_01
                </motion.text>

                <defs>
                    <radialGradient id="hubGradient" cx="120" cy="120" r="15" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#5eead4" />
                        <stop offset="0.6" stopColor="#0d9488" />
                        <stop offset="1" stopColor="#042f2e" />
                    </radialGradient>
                </defs>
            </svg>
        </div>
    );
};
