import React, { useState, useEffect } from 'react';
import { X, Cookie, Shield, CheckCircle } from 'lucide-react';
import Link from 'next/link';

const CookieConsent: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        // Check if user has already accepted cookies
        const hasAccepted = localStorage.getItem('cookieConsent');
        if (!hasAccepted) {
            // Show banner after 1 second
            setTimeout(() => setIsVisible(true), 1000);
        }
    }, []);

    const acceptAll = () => {
        localStorage.setItem('cookieConsent', 'all');
        setIsVisible(false);
    };

    const acceptEssential = () => {
        localStorage.setItem('cookieConsent', 'essential');
        setIsVisible(false);
    };

    const decline = () => {
        localStorage.setItem('cookieConsent', 'declined');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] animate-fade-in-up">
            <div className="bg-white border-t border-slate-200 shadow-2xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex-1">
                            <p className="text-sm text-slate-700 leading-relaxed">
                                We use cookies to improve your experience and analyze site traffic.{' '}
                                <Link href="/cookie-policy" className="text-teal-600 hover:text-teal-700 font-medium underline">
                                    Learn more
                                </Link>
                            </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto">
                            <button
                                onClick={acceptEssential}
                                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                            >
                                Decline
                            </button>
                            <button
                                onClick={acceptAll}
                                className="flex-1 sm:flex-none px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-all shadow-sm"
                            >
                                Accept
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CookieConsent;
