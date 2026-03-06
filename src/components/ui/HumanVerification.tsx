import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Key, Lock, CheckCircle2 } from 'lucide-react';

interface HumanVerificationProps {
    onVerify: () => void;
    verified?: boolean; // Optional controlled prop — survives parent re-renders
}

export default function HumanVerification({ onVerify, verified }: HumanVerificationProps) {
    const [internalVerified, setInternalVerified] = useState(false);
    const isVerified = verified !== undefined ? verified : internalVerified;
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        if (containerRef.current) {
            setContainerWidth(containerRef.current.offsetWidth);
        }

        const handleResize = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleDragEnd = (event: any, info: any) => {
        // If dragged more than 75% of the container width
        // The thumb width is 48px, so we account for that
        const threshold = containerWidth - 48 - 32; // Container width minus thumb minus padding
        if (info.offset.x >= threshold * 0.8) {
            setInternalVerified(true);
            onVerify();
        }
    };

    return (
        <div className="w-full space-y-2">
            <label className="text-xs text-slate-500 font-medium uppercase tracking-wider block text-center">
                Security Check
            </label>
            <div
                ref={containerRef}
                className={`relative h-14 rounded-xl flex items-center px-1.5 overflow-hidden transition-colors duration-500 ${isVerified ? 'bg-teal-500/10 border border-teal-500/30' : 'bg-slate-800/80 border border-slate-700/80'
                    }`}
            >
                <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${isVerified ? 'opacity-0' : 'opacity-100'
                    }`}>
                    <span className="text-xs font-semibold text-slate-400 tracking-widest uppercase truncate pl-12 pr-8">
                        Slide key to unlock
                    </span>
                </div>

                {isVerified ? (
                    <div className="w-full flex items-center justify-center gap-2 text-teal-400 font-bold animate-fade-in text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        Human Verified
                    </div>
                ) : (
                    <>
                        <motion.div
                            drag="x"
                            dragConstraints={containerRef}
                            dragElastic={0.05}
                            dragMomentum={false}
                            onDragEnd={handleDragEnd}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="w-11 h-11 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing z-10 shadow-[0_0_15px_rgba(45,212,191,0.3)] touch-none"
                        >
                            <Key className="w-5 h-5 text-slate-900" />
                        </motion.div>

                        <div className="absolute right-4 text-slate-600 z-0">
                            <Lock className="w-5 h-5" />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

