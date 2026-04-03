'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, Zap } from 'lucide-react';
import Confetti from 'react-confetti';

interface CelebrationOverlayProps {
    // These are now optional as the component listens to global events
    show?: boolean;
    onComplete?: () => void;
    message?: string;
    points?: number;
}

export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({ 
    show: propShow, 
    onComplete: propOnComplete, 
    message: propMessage = "Action Complete!", 
    points: propPoints = 5 
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [currentMessage, setCurrentMessage] = useState(propMessage);
    const [currentPoints, setCurrentPoints] = useState(propPoints);
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

    const hideCelebration = useCallback(() => {
        setIsVisible(false);
        if (propOnComplete) propOnComplete();
    }, [propOnComplete]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
            
            const handleResize = () => {
                setWindowSize({ width: window.innerWidth, height: window.innerHeight });
            };
            
            // Listen for global celebration events
            const handleGlobalCelebration = (e: any) => {
                const { message, points } = e.detail || {};
                setCurrentMessage(message || propMessage);
                setCurrentPoints(points || propPoints);
                setIsVisible(true);
            };

            window.addEventListener('resize', handleResize);
            window.addEventListener('action-celebration', handleGlobalCelebration);
            
            return () => {
                window.removeEventListener('resize', handleResize);
                window.removeEventListener('action-celebration', handleGlobalCelebration);
            };
        }
    }, [propMessage, propPoints]);

    // Handle prop-based visibility for backward compatibility
    useEffect(() => {
        if (propShow !== undefined) {
            setIsVisible(propShow);
        }
    }, [propShow]);

    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                hideCelebration();
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [isVisible, hideCelebration]);

    return (
        <AnimatePresence>
            {isVisible && (
                <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
                    <Confetti
                        width={windowSize.width}
                        height={windowSize.height}
                        numberOfPieces={300}
                        recycle={false}
                        colors={['#14b8a6', '#0d9488', '#2dd4bf', '#5eead4', '#ffffff']}
                    />
                    
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 1.5, opacity: 0 }}
                        transition={{ type: "spring", damping: 12, stiffness: 100 }}
                        className="bg-slate-900/90 backdrop-blur-3xl border-2 border-teal-500/50 rounded-[3rem] p-12 text-center shadow-[0_0_150px_rgba(20,184,166,0.4)] relative overflow-hidden"
                    >
                        {/* Internal Glow */}
                        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 via-transparent to-teal-500/10 pointer-events-none" />
                        
                        <div className="relative z-10 flex flex-col items-center">
                            <motion.div
                                animate={{ 
                                    rotate: [0, 15, -15, 0],
                                    scale: [1, 1.25, 1] 
                                }}
                                transition={{ duration: 0.6, repeat: 2 }}
                                className="w-28 h-28 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center mb-10 shadow-[0_0_50px_rgba(20,184,166,0.7)] border-4 border-white/30"
                            >
                                <Zap className="w-14 h-14 text-white fill-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
                            </motion.div>
                            
                            <h2 className="text-5xl font-black text-white italic tracking-tighter mb-4 uppercase drop-shadow-lg">
                                Small Win!
                            </h2>
                            
                            <p className="text-2xl font-bold text-teal-400 mb-10 uppercase tracking-[0.2em] italic">
                                {currentMessage}
                            </p>
                            
                            <div className="flex items-center gap-6 bg-slate-950/60 border-2 border-teal-500/30 rounded-3xl px-10 py-5 shadow-inner">
                                <TrendingUp className="w-8 h-8 text-teal-400 animate-bounce" />
                                <div className="flex flex-col items-start translate-y-1">
                                    <span className="text-4xl font-black text-white italic line-height-none">+{currentPoints}</span>
                                    <span className="text-[10px] font-black text-teal-500/80 uppercase tracking-widest -mt-1">Momentum Points</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Animated background rings */}
                        <motion.div 
                            animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                            className="absolute -inset-20 border border-teal-500/20 rounded-full pointer-events-none"
                        />
                        <motion.div 
                            animate={{ rotate: -360, opacity: [0.1, 0.3, 0.1] }}
                            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                            className="absolute -inset-40 border border-white/10 rounded-full pointer-events-none"
                        />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
