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
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 animate-fade-in-up">
            <div className="max-w-6xl mx-auto">
                <div className="bg-slate-900 border-2 border-teal-500/30 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden">
                    {/* Main Content */}
                    <div className="p-6 sm:p-8">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-3 bg-teal-500/10 rounded-xl flex-shrink-0">
                                <Cookie className="w-6 h-6 text-teal-400" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-white mb-2">Cookie Consent</h3>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    We use cookies to enhance your browsing experience, analyze site traffic, and provide personalized content.
                                    Your privacy is important to us.
                                </p>
                            </div>
                            <button
                                onClick={decline}
                                className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg flex-shrink-0"
                                aria-label="Close cookie banner"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Details (Expandable) */}
                        {showDetails && (
                            <div className="mb-6 space-y-3 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-white text-sm mb-1">Essential Cookies</h4>
                                        <p className="text-slate-400 text-xs">
                                            Required for authentication, security, and basic website functionality. Cannot be disabled.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-white text-sm mb-1">Analytics Cookies</h4>
                                        <p className="text-slate-400 text-xs">
                                            Help us understand how visitors use our site to improve performance and user experience.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Cookie className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-white text-sm mb-1">Marketing Cookies</h4>
                                        <p className="text-slate-400 text-xs">
                                            Used to track visitors and display personalized ads and content.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <button
                                onClick={acceptAll}
                                className="w-full sm:w-auto px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-teal-500/20"
                            >
                                Accept All Cookies
                            </button>
                            <button
                                onClick={acceptEssential}
                                className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors border border-slate-700"
                            >
                                Essential Only
                            </button>
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="w-full sm:w-auto px-6 py-3 text-slate-400 hover:text-white font-medium transition-colors text-sm"
                            >
                                {showDetails ? 'Hide Details' : 'Cookie Details'}
                            </button>
                            <Link
                                href="/cookie-policy"
                                className="w-full sm:w-auto px-6 py-3 text-teal-400 hover:text-teal-300 font-medium transition-colors text-sm text-center"
                            >
                                Learn More
                            </Link>
                        </div>
                    </div>

                    {/* Bottom Bar */}
                    <div className="bg-slate-800/50 px-6 sm:px-8 py-3 border-t border-slate-700">
                        <p className="text-xs text-slate-500 text-center">
                            By continuing to use this site, you agree to our use of cookies. See our{' '}
                            <Link href="/privacy-policy" className="text-teal-400 hover:text-teal-300">
                                Privacy Policy
                            </Link>{' '}
                            for details.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CookieConsent;
