'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import Link from 'next/link';

// -------------------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------------------
export type CookiePreferences = {
    necessary: true; // always true — cannot be disabled
    analytics: boolean;
    functional: boolean;
    marketing: boolean;
};

const STORAGE_KEY = 'ac_cookie_preferences';

function loadPreferences(): CookiePreferences | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as CookiePreferences;
    } catch {
        return null;
    }
}

function savePreferences(prefs: CookiePreferences) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
        // ignore
    }
}

// -------------------------------------------------------------------------------------
// Category definitions
// -------------------------------------------------------------------------------------
const categories = [
    {
        key: 'necessary' as const,
        label: 'Strictly Necessary',
        icon: Shield,
        color: 'teal',
        required: true,
        desc: 'Required for authentication, session management, and security. Cannot be disabled.',
        examples: ['sb-auth-token (login session)', 'CSRF protection', 'Cookie consent record'],
    },
    {
        key: 'analytics' as const,
        label: 'Analytics & Performance',
        icon: BarChart2,
        color: 'blue',
        required: false,
        desc: 'Helps us understand how visitors interact with our site. All data is anonymized.',
        examples: ['Google Analytics (_ga)', 'Vercel performance metrics', 'Core Web Vitals monitoring'],
    },
    {
        key: 'functional' as const,
        label: 'Functional',
        icon: Settings2,
        color: 'indigo',
        required: false,
        desc: 'Remembers your preferences like sidebar state, theme, and timezone for a better experience.',
        examples: ['Sidebar collapse state', 'Theme preference', 'Onboarding progress'],
    },
    {
        key: 'marketing' as const,
        label: 'Marketing',
        icon: Megaphone,
        color: 'violet',
        required: false,
        desc: 'Used for retargeting ads to visitors who did not complete registration. Used sparingly.',
        examples: ['Facebook Pixel (_fbp)', 'LinkedIn Insight Tag'],
    },
];

// -------------------------------------------------------------------------------------
// Main component
// -------------------------------------------------------------------------------------
export default function CookieConsent() {
    const [visible, setVisible] = useState(false);
    const [showPreferences, setShowPreferences] = useState(false);
    const [prefs, setPrefs] = useState<CookiePreferences>({
        necessary: true,
        analytics: false,
        functional: false,
        marketing: false,
    });

    useEffect(() => {
        const saved = loadPreferences();
        if (!saved) {
            // No consent recorded yet — show banner
            setVisible(true);
        } else {
            setPrefs(saved);
        }
    }, []);

    const acceptAll = useCallback(() => {
        const all: CookiePreferences = { necessary: true, analytics: true, functional: true, marketing: true };
        savePreferences(all);
        setPrefs(all);
        setVisible(false);
        dispatchConsentEvent(all);
    }, []);

    const rejectNonEssential = useCallback(() => {
        const minimal: CookiePreferences = { necessary: true, analytics: false, functional: false, marketing: false };
        savePreferences(minimal);
        setPrefs(minimal);
        setVisible(false);
        dispatchConsentEvent(minimal);
    }, []);

    const saveCustom = useCallback(() => {
        savePreferences(prefs);
        setVisible(false);
        setShowPreferences(false);
        dispatchConsentEvent(prefs);
    }, [prefs]);

    const toggle = (key: keyof Omit<CookiePreferences, 'necessary'>) => {
        setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="cookie-banner"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="fixed bottom-0 left-0 right-0 z-[99999]"
                >
                    {!showPreferences ? (
                        /* ── Standard bottom bar ── */
                        <div className="bg-slate-900 border-t border-slate-700/60 shadow-2xl">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                                    <p className="flex-1 text-sm text-slate-300 leading-relaxed">
                                        We use cookies to improve your experience, analyse traffic, and personalise content.{' '}
                                        <Link href="/cookie-policy" className="text-teal-400 hover:text-teal-300 underline underline-offset-2">
                                            Cookie Policy
                                        </Link>
                                    </p>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => setShowPreferences(true)}
                                            className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                                        >
                                            Manage
                                        </button>
                                        <button
                                            onClick={rejectNonEssential}
                                            className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                                        >
                                            Necessary Only
                                        </button>
                                        <button
                                            onClick={acceptAll}
                                            className="px-5 py-2 text-xs font-bold text-slate-950 bg-teal-500 hover:bg-teal-400 rounded-lg transition-colors"
                                        >
                                            Accept All
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ── Preferences panel (slides up from bottom) ── */
                        <div className="bg-slate-900 border-t border-slate-700/60 shadow-2xl">
                            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-white">Cookie Preferences</h3>
                                    <button
                                        onClick={() => setShowPreferences(false)}
                                        className="text-slate-500 hover:text-white transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-3 mb-5">
                                    {categories.map((cat) => (
                                        <div key={cat.key} className="flex items-center justify-between gap-4 py-2 border-b border-slate-800 last:border-0">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-white">{cat.label}</span>
                                                    {cat.required && (
                                                        <span className="text-[10px] text-teal-400">Always on</span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{cat.desc}</p>
                                            </div>
                                            <button
                                                onClick={() => !cat.required && toggle(cat.key as keyof Omit<CookiePreferences, 'necessary'>)}
                                                disabled={cat.required}
                                                role="switch"
                                                aria-checked={prefs[cat.key]}
                                                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                                                    cat.required
                                                        ? 'bg-teal-500 cursor-not-allowed'
                                                        : prefs[cat.key]
                                                            ? 'bg-teal-500 cursor-pointer'
                                                            : 'bg-slate-700 cursor-pointer'
                                                }`}
                                            >
                                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${prefs[cat.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={rejectNonEssential}
                                        className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-lg transition-colors"
                                    >
                                        Necessary Only
                                    </button>
                                    <button
                                        onClick={saveCustom}
                                        className="px-5 py-2 text-xs font-bold text-slate-950 bg-teal-500 hover:bg-teal-400 rounded-lg transition-colors"
                                    >
                                        Save Preferences
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// -------------------------------------------------------------------------------------
// Named export for opening the preferences panel from anywhere
// -------------------------------------------------------------------------------------
export function openCookiePreferences() {
    window.dispatchEvent(new CustomEvent('ac:open-cookie-preferences'));
}

function dispatchConsentEvent(prefs: CookiePreferences) {
    window.dispatchEvent(new CustomEvent('ac:cookie-consent', { detail: prefs }));
    // Also push to GTM dataLayer if present
    if (typeof window !== 'undefined' && (window as any).dataLayer) {
        (window as any).dataLayer.push({
            event: 'cookie_consent_update',
            cookie_consent: prefs,
        });
    }
}
