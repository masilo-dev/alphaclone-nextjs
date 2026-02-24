'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/UIComponents';

export default function CookieConsent() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Check if the user has already consented
        const hasConsented = localStorage.getItem('cookieConsent');
        if (!hasConsented) {
            setIsVisible(true);
        }
    }, []);

    const acceptCookies = () => {
        localStorage.setItem('cookieConsent', 'true');
        setIsVisible(false);
    };

    const declineCookies = () => {
        localStorage.setItem('cookieConsent', 'false');
        setIsVisible(false);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl p-6 z-[99999]"
                >
                    <div className="flex flex-col gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">Cookie Preferences</h3>
                            <p className="text-sm text-slate-400">
                                We use cookies to enhance your browsing experience, serve personalized ads or content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.
                            </p>
                        </div>

                        <div className="flex gap-3 mt-2">
                            <Button
                                onClick={acceptCookies}
                                className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
                            >
                                Accept All
                            </Button>
                            <Button
                                variant="outline"
                                onClick={declineCookies}
                                className="flex-1 border-slate-700 hover:bg-slate-800 text-white"
                            >
                                Decline
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
