'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield as ShieldIcon, BarChart2, Settings2, Megaphone, Lock, Eye, Database } from 'lucide-react';
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

const CRAWLER_USER_AGENTS = [
    'googlebot',
    'bingbot',
    'yandexbot',
    'baiduspider',
    'facebookexternalhit',
    'twitterbot',
    'rogerbot',
    'linkedinbot',
    'embedly',
    'quora link preview',
    'showyoubot',
    'outbrain',
    'pinterest/0.',
    'developers.google.com/+/web/snippet',
    'slackbot',
    'vkshare',
    'w3c_validator',
    'redditbot',
    'applebot',
    'whatsapp',
    'flipboard',
    'tumblr',
    'bitlybot',
    'skypeuripreview',
    'nuzzel',
    'discordbot',
    'google page speed',
    'qwantify',
    'pinterestbot',
    'bitrix link preview',
    'xing-content-proxy',
    'chrome-lighthouse',
    'telegrambot',
    'seo-site-checkup'
];

function isCrawler(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent.toLowerCase();
    return CRAWLER_USER_AGENTS.some(bot => ua.includes(bot));
}

function savePreferences(prefs: CookiePreferences) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
        // ignore
    }
}

const categories = [
    {
        key: 'necessary' as const,
        label: 'Strictly Necessary',
        icon: Lock,
        required: true,
        desc: 'Essential for platform security, authentication, and basic functionality. Cannot be turned off.',
    },
    {
        key: 'analytics' as const,
        label: 'Analytics & Performance',
        icon: Eye,
        required: false,
        desc: 'Helps us measure performance and improve your experience. Data is anonymized.',
    },
    {
        key: 'functional' as const,
        label: 'Functional',
        icon: Database,
        required: false,
        desc: 'Remembers your preferences like language, timezone, and UI state for convenience.',
    },
    {
        key: 'marketing' as const,
        label: 'Marketing',
        icon: Megaphone,
        required: false,
        desc: 'Used to deliver relevant information and track the effectiveness of our growth campaigns.',
    },
];

export default function CookieConsent() {
    const [visible, setVisible] = useState(false);
    const [showPreferences, setShowPreferences] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [prefs, setPrefs] = useState<CookiePreferences>({
        necessary: true,
        analytics: false,
        functional: false,
        marketing: false,
    });

    useEffect(() => {
        const saved = loadPreferences();
        if (!saved && !isCrawler()) {
            setVisible(true);
        } else if (saved) {
            setPrefs(saved);
        }

        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const openPrefs = () => {
            setVisible(true);
            setShowPreferences(true);
        };
        window.addEventListener('ac:open-cookie-preferences', openPrefs);
        return () => window.removeEventListener('ac:open-cookie-preferences', openPrefs);
    }, []);

    const completeConsent = useCallback((finalPrefs: CookiePreferences) => {
        savePreferences(finalPrefs);
        setPrefs(finalPrefs);
        setVisible(false);
        setShowPreferences(false);
        dispatchConsentEvent(finalPrefs);
    }, []);

    const acceptAll = useCallback(() => {
        completeConsent({ necessary: true, analytics: true, functional: true, marketing: true });
    }, [completeConsent]);

    const rejectAll = useCallback(() => {
        completeConsent({ necessary: true, analytics: false, functional: false, marketing: false });
    }, [completeConsent]);

    const saveCustom = useCallback(() => {
        completeConsent(prefs);
    }, [prefs, completeConsent]);

    const toggle = (key: keyof Omit<CookiePreferences, 'necessary'>) => {
        setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <AnimatePresence mode="wait">
            {visible && (
                <>
                    {/* Backdrop to ensure intentional choice (2026 Compliance) */}
                    <motion.div
                        key="cookie-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[99998] bg-slate-950/80 backdrop-blur-[6px]"
                        aria-hidden="true"
                    />

                    <div className={`fixed z-[99999] inset-0 flex items-center justify-center pointer-events-none p-4 ${isMobile ? 'items-end !p-0' : ''}`}>
                        <motion.div
                            key="cookie-container"
                            initial={isMobile ? { y: '100%' } : { scale: 0.9, opacity: 0 }}
                            animate={isMobile ? { y: 0 } : { scale: 1, opacity: 1 }}
                            exit={isMobile ? { y: '100%' } : { scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                            className={`
                                pointer-events-auto bg-[#0A0D14] border border-slate-800/60 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)]
                                flex flex-col overflow-hidden
                                ${isMobile ? 'w-full rounded-t-[2.5rem] max-h-[85vh]' : 'w-full max-w-xl rounded-[2rem]'}
                            `}
                        >
                            {!showPreferences ? (
                                /* ── Phase 1: High-Level summary (3-Button Rule) ── */
                                <div className="p-8 sm:p-10">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-2xl border border-teal-500/20">
                                            <ShieldIcon className="w-6 h-6 text-teal-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">Cookie Consent</h2>
                                            <p className="text-xs text-teal-500/60 uppercase tracking-widest font-semibold mt-0.5">Privacy First Platform</p>
                                        </div>
                                    </div>

                                    <p className="text-base sm:text-lg text-slate-300 leading-relaxed mb-10">
                                        We use cookies to maintain security, optimize performance, and personalize your experience. No marketing cookies are active unless you intentionally consent. Review our{' '}
                                        <Link href="/cookie-policy" className="text-teal-400 hover:text-teal-300 underline underline-offset-8 decoration-teal-500/30 font-medium">Cookie Policy</Link>.
                                    </p>

                                    {/* Three-Button Rule: Equal Prominence & Height */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <button
                                            onClick={acceptAll}
                                            className="h-[56px] sm:h-auto py-4 px-6 bg-teal-500 hover:bg-teal-400 text-[#020617] font-bold rounded-2xl transition-all active:scale-[0.97] text-base"
                                        >
                                            Accept All
                                        </button>
                                        <button
                                            onClick={rejectAll}
                                            className="h-[56px] sm:h-auto py-4 px-6 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl border border-slate-700/50 transition-all active:scale-[0.97] text-base"
                                        >
                                            Reject All
                                        </button>
                                        <button
                                            onClick={() => setShowPreferences(true)}
                                            className="sm:col-span-2 h-[56px] sm:h-auto py-4 px-6 bg-transparent hover:bg-slate-800/40 text-slate-400 hover:text-slate-200 font-semibold rounded-2xl border border-dashed border-slate-800 hover:border-slate-700 transition-all active:scale-[0.97] text-base"
                                        >
                                            Manage Preferences
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* ── Phase 2: Granular Choice (Thumb-Friendly) ── */
                                <div className="p-8 sm:p-10 flex flex-col h-full bg-[#0A0D14]">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-800 rounded-lg">
                                                <Settings2 className="w-5 h-5 text-teal-400" />
                                            </div>
                                            <h2 className="text-xl sm:text-2xl font-bold text-white">Manage Settings</h2>
                                        </div>
                                        <button 
                                            onClick={() => setShowPreferences(false)}
                                            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                                            aria-label="Back"
                                        >
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>

                                    <div className="space-y-4 mb-10 overflow-y-auto pr-2 custom-scrollbar">
                                        {categories.map((cat) => (
                                            <div key={cat.key} className="flex items-start justify-between gap-5 p-5 rounded-2xl bg-slate-900/40 border border-slate-800/50 transition-all hover:bg-slate-900/60 hover:border-slate-800">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2.5 mb-2">
                                                        <cat.icon className="w-5 h-5 text-slate-500" />
                                                        <span className="text-base font-bold text-white">{cat.label}</span>
                                                        {cat.required && (
                                                            <span className="text-xs uppercase tracking-wider px-2 py-0.5 bg-teal-500/10 text-teal-400 rounded-lg border border-teal-500/20">Always Active</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-slate-400 leading-relaxed font-medium">{cat.desc}</p>
                                                </div>
                                                
                                                <button
                                                    onClick={() => !cat.required && toggle(cat.key as keyof Omit<CookiePreferences, 'necessary'>)}
                                                    disabled={cat.required}
                                                    role="switch"
                                                    aria-checked={prefs[cat.key]}
                                                    className={`
                                                        relative w-[56px] h-[32px] rounded-full transition-all flex-shrink-0 mt-1.5
                                                        ${cat.required 
                                                            ? 'bg-teal-500/40 cursor-not-allowed shadow-none' 
                                                            : prefs[cat.key] 
                                                                ? 'bg-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.3)]' 
                                                                : 'bg-slate-800'}
                                                    `}
                                                >
                                                    <span className={`
                                                        absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-xl transition-transform duration-300 cubic-bezier(0.34, 1.56, 0.64, 1)
                                                        ${prefs[cat.key] ? 'translate-x-[24px]' : 'translate-x-0'}
                                                    `} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <button
                                            onClick={saveCustom}
                                            className="flex-1 h-[56px] sm:h-auto py-4 px-6 bg-teal-500 hover:bg-teal-400 text-[#020617] font-bold rounded-2xl transition-all shadow-lg active:scale-[0.97] text-base"
                                        >
                                            Save Settings
                                        </button>
                                        <button
                                            onClick={rejectAll}
                                            className="flex-1 h-[56px] sm:h-auto py-4 px-6 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl border border-slate-700/50 transition-all active:scale-[0.97] text-base"
                                        >
                                            Reject All
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}

// Global hook/helper to reopen the preferences
export function openCookiePreferences() {
    window.dispatchEvent(new CustomEvent('ac:open-cookie-preferences'));
}

function dispatchConsentEvent(prefs: CookiePreferences) {
    window.dispatchEvent(new CustomEvent('ac:cookie-consent', { detail: prefs }));
    if (typeof window !== 'undefined' && (window as any).dataLayer) {
        (window as any).dataLayer.push({
            event: 'cookie_consent_update',
            cookie_consent: prefs,
        });
    }
}

