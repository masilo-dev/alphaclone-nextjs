'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, Shield, BarChart2, Settings2, Megaphone, X, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
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
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
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
        <>
            {/* Re-open button (always available in footer via data-cookie-open) */}
            <AnimatePresence mode="wait">
                {visible && (
                    <motion.div
                        key="cookie-banner"
                        initial={{ y: 120, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 120, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                        className="fixed bottom-0 left-0 right-0 z-[99999] pointer-events-none"
                    >
                        <div className="pointer-events-auto mx-auto max-w-5xl mb-4 mx-4 md:mx-8">
                            {!showPreferences ? (
                                /* ── Compact Banner ── */
                                <div className="relative bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/40 p-5 md:p-6">
                                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                                        <div className="flex items-start gap-3 flex-1">
                                            <Cookie className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <h3 className="text-white font-bold text-sm mb-1">Cookie Preferences</h3>
                                                <p className="text-slate-400 text-xs leading-relaxed">
                                                    We use cookies for authentication, analytics, and personalization. You control which non-essential cookies are active.{' '}
                                                    <Link href="/cookie-policy" className="text-teal-400 hover:underline inline-flex items-center gap-1">
                                                        Cookie Policy <ExternalLink className="w-3 h-3" />
                                                    </Link>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => setShowPreferences(true)}
                                                className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
                                            >
                                                Manage Preferences
                                            </button>
                                            <button
                                                onClick={rejectNonEssential}
                                                className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
                                            >
                                                Reject Non-Essential
                                            </button>
                                            <button
                                                onClick={acceptAll}
                                                className="px-5 py-2 text-xs font-bold text-slate-950 bg-teal-500 hover:bg-teal-400 rounded-xl transition-colors shadow-lg shadow-teal-500/20"
                                            >
                                                Accept All
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* ── Full Preference Panel ── */
                                <div className="relative bg-slate-900/98 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800">
                                        <div className="flex items-center gap-3">
                                            <Cookie className="w-5 h-5 text-amber-400" />
                                            <div>
                                                <h3 className="text-white font-bold text-sm">Cookie Preferences</h3>
                                                <p className="text-slate-500 text-xs">Choose which cookies to accept</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowPreferences(false)}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Categories */}
                                    <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-800/50">
                                        {categories.map((cat) => (
                                            <div key={cat.key}>
                                                <div className="flex items-center gap-3 px-6 py-4">
                                                    <cat.icon className={`w-4 h-4 text-${cat.color}-400 flex-shrink-0`} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-white text-xs font-semibold">{cat.label}</span>
                                                            {cat.required && (
                                                                <span className="text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full px-2 py-0.5">Always Active</span>
                                                            )}
                                                        </div>
                                                        <p className="text-slate-500 text-[11px] leading-relaxed mt-0.5 pr-4">{cat.desc}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3 flex-shrink-0">
                                                        <button
                                                            onClick={() => setExpandedCategory(expandedCategory === cat.key ? null : cat.key)}
                                                            className="text-slate-500 hover:text-slate-300 transition-colors"
                                                            aria-label="Show examples"
                                                        >
                                                            {expandedCategory === cat.key
                                                                ? <ChevronUp className="w-4 h-4" />
                                                                : <ChevronDown className="w-4 h-4" />
                                                            }
                                                        </button>
                                                        {/* Toggle */}
                                                        <button
                                                            onClick={() => !cat.required && toggle(cat.key as keyof Omit<CookiePreferences, 'necessary'>)}
                                                            disabled={cat.required}
                                                            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${cat.required
                                                                    ? 'bg-teal-500 cursor-not-allowed'
                                                                    : prefs[cat.key]
                                                                        ? 'bg-teal-500 cursor-pointer'
                                                                        : 'bg-slate-700 cursor-pointer'
                                                                }`}
                                                            aria-checked={prefs[cat.key]}
                                                            role="switch"
                                                        >
                                                            <span
                                                                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${prefs[cat.key] ? 'translate-x-5' : 'translate-x-0'
                                                                    }`}
                                                            />
                                                        </button>
                                                    </div>
                                                </div>
                                                {/* Examples accordion */}
                                                <AnimatePresence>
                                                    {expandedCategory === cat.key && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.15 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="px-6 pb-4 bg-slate-950/50">
                                                                <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold mb-2">Cookies in this category:</p>
                                                                <ul className="space-y-1">
                                                                    {cat.examples.map((ex, i) => (
                                                                        <li key={i} className="flex items-center gap-2 text-[11px] text-slate-400">
                                                                            <span className="w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" />
                                                                            {ex}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                                <Link href="/cookie-policy" className="mt-3 inline-flex items-center gap-1 text-[11px] text-teal-400 hover:underline">
                                                                    Full Cookie Policy <ExternalLink className="w-3 h-3" />
                                                                </Link>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer buttons */}
                                    <div className="flex flex-wrap gap-2 px-6 py-4 border-t border-slate-800 bg-slate-950/40">
                                        <button
                                            onClick={rejectNonEssential}
                                            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
                                        >
                                            Reject Non-Essential
                                        </button>
                                        <button
                                            onClick={acceptAll}
                                            className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
                                        >
                                            Accept All
                                        </button>
                                        <button
                                            onClick={saveCustom}
                                            className="ml-auto px-6 py-2 text-xs font-bold text-slate-950 bg-teal-500 hover:bg-teal-400 rounded-xl transition-colors shadow-lg shadow-teal-500/20"
                                        >
                                            Save My Preferences
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
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
