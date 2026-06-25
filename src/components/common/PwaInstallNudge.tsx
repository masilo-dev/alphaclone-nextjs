'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X, Download } from 'lucide-react';
import { usePWA } from '@/contexts/PWAContext';

const LAST_KEY = 'ac_pwa_nudge_last';
const DISMISS_SESSION = 'ac_pwa_nudge_dismissed_session';
const INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;
const MIN_IDLE_MS = 30_000;
const MAX_WAIT_MS = 90_000;

const DASHBOARD_SCROLL_SELECTORS = '.ac-business-scroll, .ac-dashboard-main, #main-content';

function isBlockingOverlayActive(): boolean {
    if (typeof document === 'undefined') return false;
    return Boolean(
        document.getElementById('react-joyride-portal') ||
        document.documentElement.hasAttribute('data-product-tour-active'),
    );
}

/**
 * Occasional reminder for dashboard users to install the PWA (standalone app).
 * Shown only after the user has scrolled or interacted with the dashboard so
 * core navigation is never blocked on first load.
 */
export default function PwaInstallNudge() {
    const pathname = usePathname();
    const { isPWA, isLoading } = usePWA();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (isLoading || isPWA) return;
        if (!pathname?.startsWith('/dashboard')) return;
        if (window.matchMedia('(display-mode: standalone)').matches) return;
        if (sessionStorage.getItem(DISMISS_SESSION) === '1') return;

        const last = parseInt(localStorage.getItem(LAST_KEY) || '0', 10);
        if (Date.now() - last < INTERVAL_MS) return;

        let cancelled = false;
        let hasEngaged = false;
        let scheduled = false;
        const mountedAt = Date.now();

        const maybeOpen = () => {
            if (cancelled) return;
            if (isBlockingOverlayActive()) return;
            const idleLongEnough = Date.now() - mountedAt >= MIN_IDLE_MS;
            if (!hasEngaged && !idleLongEnough) return;
            setOpen(true);
        };

        const onEngage = () => {
            hasEngaged = true;
            if (scheduled) return;
            scheduled = true;
            window.setTimeout(maybeOpen, MIN_IDLE_MS);
        };

        const scrollTargets = Array.from(
            document.querySelectorAll<HTMLElement>(DASHBOARD_SCROLL_SELECTORS),
        );
        scrollTargets.forEach((el) => el.addEventListener('scroll', onEngage, { passive: true }));
        window.addEventListener('wheel', onEngage, { passive: true });
        window.addEventListener('touchmove', onEngage, { passive: true });
        window.addEventListener('pointerdown', onEngage, { passive: true });

        const poll = window.setInterval(maybeOpen, 1000);
        const maxWait = window.setTimeout(maybeOpen, MAX_WAIT_MS);

        return () => {
            cancelled = true;
            window.clearInterval(poll);
            window.clearTimeout(maxWait);
            scrollTargets.forEach((el) => el.removeEventListener('scroll', onEngage));
            window.removeEventListener('wheel', onEngage);
            window.removeEventListener('touchmove', onEngage);
            window.removeEventListener('pointerdown', onEngage);
        };
    }, [isPWA, isLoading, pathname]);

    if (!open) return null;

    const later = () => {
        localStorage.setItem(LAST_KEY, String(Date.now()));
        setOpen(false);
    };

    const dismiss = () => {
        sessionStorage.setItem(DISMISS_SESSION, '1');
        setOpen(false);
    };

    return (
        <div
            className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:max-w-md z-[48] pointer-events-none"
            aria-hidden
        >
            <div
                role="region"
                aria-label="Install app"
                className="pointer-events-auto rounded-xl border border-slate-600 bg-slate-900 shadow-xl p-4 text-left"
            >
            <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-teal-500/15 text-teal-400 shrink-0">
                    <Download className="w-5 h-5" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">Install AlphaClone as an app</p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Use your browser menu: Install app, or Add to Home Screen on mobile. You get a home screen icon
                        and a focused window without the browser toolbar.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                        <button
                            type="button"
                            onClick={later}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white"
                        >
                            Remind me later
                        </button>
                        <button
                            type="button"
                            onClick={dismiss}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={dismiss}
                    className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 shrink-0"
                    aria-label="Close"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
            </div>
        </div>
    );
}
