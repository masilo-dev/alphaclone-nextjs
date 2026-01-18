import React, { useState, useEffect, useCallback } from 'react';

interface SessionTimeoutWarningProps {
    onExtendSession: () => void;
    onLogout: () => void;
}

export const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
    onExtendSession,
    onLogout,
}) => {
    const [showWarning, setShowWarning] = useState(false);
    const [countdown, setCountdown] = useState(120); // 2 minutes

    useEffect(() => {
        if (showWarning) {
            const interval = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        onLogout();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [showWarning, onLogout]);

    const handleExtend = () => {
        setShowWarning(false);
        setCountdown(120);
        onExtendSession();
    };

    if (!showWarning) return null;

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
                        onClick={handleExtend}
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

// Hook to trigger the warning
export const useSessionTimeoutWarning = (
    onLogout: () => void,
    timeoutMs: number = 10 * 60 * 1000, // 10 minutes
    warningMs: number = 2 * 60 * 1000 // 2 minutes before timeout
) => {
    const [showWarning, setShowWarning] = useState(false);
    const [lastActivity, setLastActivity] = useState(Date.now());

    const resetActivity = useCallback(() => {
        setLastActivity(Date.now());
        setShowWarning(false);
    }, []);

    const extendSession = useCallback(() => {
        resetActivity();
    }, [resetActivity]);

    useEffect(() => {
        // Activity listeners
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

        events.forEach(event => {
            document.addEventListener(event, resetActivity);
        });

        // Check for inactivity
        const checkInterval = setInterval(() => {
            const now = Date.now();
            const timeSinceActivity = now - lastActivity;

            // Show warning 2 minutes before timeout
            if (timeSinceActivity >= timeoutMs - warningMs && !showWarning) {
                setShowWarning(true);
            }

            // Auto logout at timeout
            if (timeSinceActivity >= timeoutMs) {
                onLogout();
            }
        }, 1000);

        return () => {
            events.forEach(event => {
                document.removeEventListener(event, resetActivity);
            });
            clearInterval(checkInterval);
        };
    }, [lastActivity, timeoutMs, warningMs, showWarning, onLogout, resetActivity]);

    return { showWarning, extendSession };
};
