/**
 * Exit-Intent Utilities
 * 
 * Centralized logic for exit-intent improvement capture system.
 * Handles PWA detection, localStorage management, and gatekeeper logic.
 */

const EXIT_INTENT_KEY = 'exit_improvement_completed';
const EXIT_INTENT_TIMESTAMP_KEY = 'exit_improvement_timestamp';

/**
 * Check if running in PWA mode
 */
export const isPWA = (): boolean => {
    if (typeof window === 'undefined') return false;

    // Check display mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    // Check iOS standalone
    const isIOSStandalone = (window.navigator as any).standalone === true;

    return isStandalone || isIOSStandalone;
};

/**
 * Check if exit-intent has been completed in localStorage
 */
export const hasCompletedExitIntent = (): boolean => {
    if (typeof window === 'undefined') return true;

    const completed = localStorage.getItem(EXIT_INTENT_KEY);
    return completed === 'true';
};

/**
 * Mark exit-intent as completed in localStorage
 */
export const markExitIntentCompleted = (): void => {
    if (typeof window === 'undefined') return;

    localStorage.setItem(EXIT_INTENT_KEY, 'true');
    localStorage.setItem(EXIT_INTENT_TIMESTAMP_KEY, new Date().toISOString());
};

/**
 * Check if user has completed exit-intent (from user profile)
 */
export const hasUserCompletedExitIntent = (user: any): boolean => {
    if (!user) return false;

    return user.has_seen_exit_improvement === true ||
        user.has_submitted_exit_improvement === true;
};

/**
 * Main gatekeeper function - determines if exit-intent modal should show
 * 
 * Returns true only if ALL conditions are met:
 * 1. Not in PWA mode
 * 2. Not previously shown (localStorage or user flag)
 * 3. Exit intent has been triggered
 */
export const shouldShowExitIntent = (
    user: any | null,
    exitIntentTriggered: boolean
): boolean => {
    // Never show in PWA
    if (isPWA()) {
        return false;
    }

    // Check localStorage for anonymous users
    if (hasCompletedExitIntent()) {
        return false;
    }

    // Check user profile flags for logged-in users
    if (user && hasUserCompletedExitIntent(user)) {
        return false;
    }

    // Only show if exit intent was actually triggered
    return exitIntentTriggered;
};

/**
 * Get user type for improvement submission
 */
export const getUserType = (user: any | null): 'visitor' | 'client' | 'tenant_admin' | 'admin' => {
    if (!user) return 'visitor';

    switch (user.role) {
        case 'admin':
            return 'admin';
        case 'tenant_admin':
            return 'tenant_admin';
        case 'client':
            return 'client';
        default:
            return 'visitor';
    }
};
