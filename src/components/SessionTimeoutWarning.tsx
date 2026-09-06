import React, { useState, useEffect, useCallback } from 'react';

interface SessionTimeoutWarningProps {
    isOpen: boolean;
    countdown: number;
    onExtendSession: () => void;
    onLogout: () => void;
}

export const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
    isOpen,
    countdown,
    onExtendSession,
    onLogout,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-yellow-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fade-in">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Session Expiring Soon</h3>
                        <p className="text-sm text-slate-400">Your session will expire in {countdown} seconds</p>
                    </div>
                </div>

                <p className="text-slate-300 mb-6">
                    You've been inactive for a while. To protect your account, we'll log you out automatically unless you extend your session.
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={onExtendSession}
                        className="flex-1 px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors"
                    >
                        Stay Logged In
                    </button>
                    <button
                        onClick={onLogout}
                        className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors"
                    >
                        Log Out Now
                    </button>
                </div>

                <div className="mt-4 text-center text-xs text-slate-500">
                    Any unsaved changes will be lost if you log out
                </div>
            </div>
        </div>
    );
};

const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;

/**
 * Idle timeout before auto sign-out. Tunable per deployment with
 * NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES (minimum 3, so the 2-minute warning
 * still has room to show). Previously hard-coded to 10 minutes, which signed
 * people out after a short call or meeting.
 */
export function resolveIdleTimeoutMs(raw: string | undefined = process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES): number {
    const minutes = Number(raw);
    const safe = Number.isFinite(minutes) && minutes >= 3 ? minutes : DEFAULT_IDLE_TIMEOUT_MINUTES;
    return safe * 60 * 1000;
}

/**
 * Events that prove the person is still here. `scroll` does not bubble, and the
 * dashboard scrolls inside a fixed-height shell, so it is registered in the
 * capture phase; `wheel` covers trackpad scrolling that never moves the pointer.
 */
export const SESSION_ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'wheel', 'touchstart', 'click', 'mousemove', 'pointerdown'] as const;

// Hook to manage the timeout logic
export const useSessionTimeoutWarning = (
    onLogout: () => void,
    timeoutMs: number = resolveIdleTimeoutMs(),
    warningMs: number = 2 * 60 * 1000 // 2 minutes before timeout
) => {
    const [showWarning, setShowWarning] = useState(false);
    const [lastActivity, setLastActivity] = useState(Date.now());
    const [countdown, setCountdown] = useState(Math.floor(warningMs / 1000));

    const resetActivity = useCallback(() => {
        setLastActivity(Date.now());
        setShowWarning(false);
        setCountdown(Math.floor(warningMs / 1000));
    }, [warningMs]);

    const extendSession = useCallback(() => {
        resetActivity();
    }, [resetActivity]);

    useEffect(() => {
        // Only add listeners if warning is NOT showing (don't auto-reset if they're just moving mouse over warning)
        const handleActivity = () => {
            if (!showWarning) {
                resetActivity();
            }
        };

        // Capture phase so scrolls inside nested containers count as activity.
        const listenerOptions: AddEventListenerOptions = { passive: true, capture: true };
        SESSION_ACTIVITY_EVENTS.forEach(event => {
            document.addEventListener(event, handleActivity, listenerOptions);
        });

        // Check for inactivity
        const checkInterval = setInterval(() => {
            const now = Date.now();
            const timeSinceActivity = now - lastActivity;

            // Show warning
            if (timeSinceActivity >= timeoutMs - warningMs) {
                if (!showWarning) {
                    setShowWarning(true);
                }

                // Calculate remaining seconds
                const remaining = Math.max(0, Math.floor((timeoutMs - timeSinceActivity) / 1000));
                setCountdown(remaining);

                // Auto logout at zero
                if (remaining <= 0) {
                    clearInterval(checkInterval);
                    onLogout();
                }
            }
        }, 1000);

        return () => {
            SESSION_ACTIVITY_EVENTS.forEach(event => {
                document.removeEventListener(event, handleActivity, listenerOptions);
            });
            clearInterval(checkInterval);
        };
    }, [lastActivity, timeoutMs, warningMs, showWarning, onLogout, resetActivity]);

    return { showWarning, countdown, extendSession };
};

