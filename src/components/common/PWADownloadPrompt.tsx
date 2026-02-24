'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Settings } from 'lucide-react';

export default function PWADownloadPrompt() {
    const [isPromptOpen, setIsPromptOpen] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    // Track if we're technically running outside browser shell (PWA installed)
    const isStandalone = typeof window !== 'undefined' &&
        window.matchMedia('(display-mode: standalone)').matches;

    useEffect(() => {
        // Only detect environment logic if we aren't already installed
        if (isStandalone) return;

        // Detect iOS
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(isIosDevice);

        // Listen for default Chrome/Android prompt installation
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        });

    }, [isStandalone]);

    // Don't show the setup button ever if they already installed the app
    if (isStandalone) return null;

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
            }
        } else {
            setIsPromptOpen(true);
        }
    };

    return (
        <>
            {/* Floating Download Action Button */}
            <button
                onClick={handleInstallClick}
                className="fixed bottom-24 right-4 bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-full shadow-lg shadow-blue-900/40 z-[9900] transition-colors flex items-center gap-2 group"
                aria-label="Install App"
            >
                <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out font-medium whitespace-nowrap pl-1 text-sm">
                    Download App
                </span>
                <Download className="w-5 h-5 flex-shrink-0" />
            </button>

            {/* Manual Install Instructions Modal (Mainly for iOS or Unsupported Chrome) */}
            <AnimatePresence>
                {isPromptOpen && (
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsPromptOpen(false)}
                            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-sm w-full shadow-2xl"
                        >
                            <button
                                onClick={() => setIsPromptOpen(false)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="text-center">
                                <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                    <Download className="w-8 h-8 text-blue-400" />
                                </div>

                                <h3 className="text-xl font-bold text-white mb-2">Install AlphaClone</h3>
                                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                                    Install our app shortcut on your home screen for a fast, native-like experience.
                                </p>

                                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-left">
                                    {isIOS ? (
                                        <ol className="text-sm text-slate-300 space-y-3">
                                            <li className="flex items-start gap-3">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">1</span>
                                                <span>Tap the <strong>Share</strong> button at the bottom of your browser.</span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">2</span>
                                                <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                                            </li>
                                        </ol>
                                    ) : (
                                        <ol className="text-sm text-slate-300 space-y-3">
                                            <li className="flex items-start gap-3">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">1</span>
                                                <span>Tap the <Settings className="w-4 h-4 inline-block mx-1" /> <strong>three dots</strong> menu in your browser.</span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">2</span>
                                                <span>Select <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</span>
                                            </li>
                                        </ol>
                                    )}
                                </div>

                                <button
                                    onClick={() => setIsPromptOpen(false)}
                                    className="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors"
                                >
                                    Got it
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
