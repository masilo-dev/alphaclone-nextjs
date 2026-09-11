'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';

interface CelebrationOverlayProps {
    title: string;
    message: string;
    isOpen: boolean;
    onClose: () => void;
}

export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({
    title,
    message,
    isOpen,
    onClose
}) => {
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                onClose();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -20 }}
                        className="bg-slate-900 border-2 border-teal-500 rounded-[2rem] p-8 max-w-md w-full shadow-[0_0_50px_rgba(20,184,166,0.3)] backdrop-blur-xl pointer-events-auto relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-blue-500/10" />
                        
                        <div className="relative z-10 flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-teal-500 rounded-2xl flex items-center justify-center mb-6 shadow-[0_10px_30px_rgba(20,184,166,0.4)] rotate-3">
                                <Sparkles className="w-10 h-10 text-slate-900" />
                            </div>
                            
                            <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">
                                {title}
                            </h2>
                            <p className="text-teal-400 font-mono text-xs uppercase tracking-[0.3em] mb-4">
                                Achievement Unlocked
                            </p>
                            
                            <p className="text-slate-300 text-lg font-medium">
                                {message}
                            </p>
                            
                            <button 
                                onClick={onClose}
                                className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
