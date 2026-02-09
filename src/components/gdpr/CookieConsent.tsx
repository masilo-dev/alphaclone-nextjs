'use client';

import { useState, useEffect } from 'react';
import { X, Cookie, Shield, BarChart, Target } from 'lucide-react';
import { consentService, ConsentType } from '../../services/gdpr/consentService';
import { useAuth } from '../../contexts/AuthContext';

export function CookieConsent() {
    const { user } = useAuth();
    const [isVisible, setIsVisible] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [consents, setConsents] = useState({
        cookies_essential: true,
        cookies_analytics: false,
        cookies_marketing: false,
    });

    useEffect(() => {
        checkConsentStatus();
    }, [user]);

    async function checkConsentStatus() {
        if (!user) {
            // Check localStorage for anonymous users
            const hasConsented = localStorage.getItem('cookie_consent');
            if (!hasConsented) {
                setIsVisible(true);
            }
            return;
        }

        // Check database for authenticated users
        const userConsents = await consentService.getUserConsents(user.id);
        const hasCookieConsent = userConsents.some(c =>
            c.consent_type.startsWith('cookies_')
        );

        if (!hasCookieConsent) {
            setIsVisible(true);
        }
    }

    async function handleAcceptAll() {
        const newConsents = {
            cookies_essential: true,
            cookies_analytics: true,
            cookies_marketing: true,
        };

        await saveConsents(newConsents);
        setIsVisible(false);
    }

    async function handleAcceptEssential() {
        const newConsents = {
            cookies_essential: true,
            cookies_analytics: false,
            cookies_marketing: false,
        };

        await saveConsents(newConsents);
        setIsVisible(false);
    }

    async function handleSavePreferences() {
        await saveConsents(consents);
        setIsVisible(false);
    }

    async function saveConsents(consentData: typeof consents) {
        if (user) {
            // Save to database for authenticated users
            await consentService.recordConsent(
                user.id,
                'cookies_essential' as ConsentType,
                consentData.cookies_essential
            );
            await consentService.recordConsent(
                user.id,
                'cookies_analytics' as ConsentType,
                consentData.cookies_analytics
            );
            await consentService.recordConsent(
                user.id,
                'cookies_marketing' as ConsentType,
                consentData.cookies_marketing
            );
        } else {
            // Save to localStorage for anonymous users
            localStorage.setItem('cookie_consent', JSON.stringify(consentData));
        }

        // Set cookies based on consent
        if (consentData.cookies_analytics) {
            // Enable Google Analytics, Vercel Analytics, etc.
            if (typeof window.gtag !== 'undefined') {
                window.gtag('consent', 'update', {
                    analytics_storage: 'granted',
                });
            }
        }

        if (consentData.cookies_marketing) {
            // Enable marketing cookies
            if (typeof window.gtag !== 'undefined') {
                window.gtag('consent', 'update', {
                    ad_storage: 'granted',
                });
            }
        }
    }

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 bg-gradient-to-t from-black/50 to-transparent">
            <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
                {/* Simple View */}
                {!showDetails && (
                    <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center">
                                <Cookie className="h-8 w-8 text-blue-600 mr-3" />
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        Cookie Consent
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        We use cookies to enhance your experience. Essential
                                        cookies are required; analytics and marketing cookies are
                                        optional.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={handleAcceptAll}
                                className="flex-1 sm:flex-none bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                            >
                                Accept All
                            </button>
                            <button
                                onClick={handleAcceptEssential}
                                className="flex-1 sm:flex-none bg-gray-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                            >
                                Essential Only
                            </button>
                            <button
                                onClick={() => setShowDetails(true)}
                                className="flex-1 sm:flex-none border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                            >
                                Customize
                            </button>
                        </div>

                        <p className="text-xs text-gray-500 mt-4">
                            By clicking "Accept All", you agree to our use of cookies. Learn
                            more in our{' '}
                            <a href="/privacy" className="text-blue-600 hover:underline">
                                Privacy Policy
                            </a>
                            .
                        </p>
                    </div>
                )}

                {/* Detailed View */}
                {showDetails && (
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-gray-900">
                                Cookie Preferences
                            </h3>
                            <button
                                onClick={() => setShowDetails(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Essential Cookies */}
                            <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                                <Shield className="h-6 w-6 text-green-600 mr-3 mt-1" />
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-semibold text-gray-900">
                                            Essential Cookies
                                        </h4>
                                        <span className="text-sm font-medium text-green-600">
                                            Always Active
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Required for the website to function properly. Cannot be
                                        disabled.
                                    </p>
                                </div>
                            </div>

                            {/* Analytics Cookies */}
                            <div className="flex items-start p-4 border border-gray-200 rounded-lg">
                                <BarChart className="h-6 w-6 text-blue-600 mr-3 mt-1" />
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-semibold text-gray-900">
                                            Analytics Cookies
                                        </h4>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={consents.cookies_analytics}
                                                onChange={e =>
                                                    setConsents({
                                                        ...consents,
                                                        cookies_analytics: e.target.checked,
                                                    })
                                                }
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Help us understand how visitors interact with our website
                                        (Google Analytics, Vercel Analytics).
                                    </p>
                                </div>
                            </div>

                            {/* Marketing Cookies */}
                            <div className="flex items-start p-4 border border-gray-200 rounded-lg">
                                <Target className="h-6 w-6 text-purple-600 mr-3 mt-1" />
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-semibold text-gray-900">
                                            Marketing Cookies
                                        </h4>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={consents.cookies_marketing}
                                                onChange={e =>
                                                    setConsents({
                                                        ...consents,
                                                        cookies_marketing: e.target.checked,
                                                    })
                                                }
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Used to track visitors across websites to show relevant
                                        advertisements.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={handleSavePreferences}
                                className="flex-1 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                            >
                                Save Preferences
                            </button>
                            <button
                                onClick={() => setShowDetails(false)}
                                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
