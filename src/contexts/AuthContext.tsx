'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authService } from '../services/authService';
import { User, UserRole } from '../types';
import { AuthChangeEvent } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    signOut: () => Promise<void>;
    cancelAccountDeletion: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


/**
 * Helper to get a cookie value by name.
 */
function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(';').shift() || '');
    return null;
}

/**
 * Read the Supabase session from localStorage OR cookies synchronously.
 * Called INSIDE useEffect so it always reads the current state of storage.
 */
function readSessionFromStorage(): User | null {
    try {
        if (typeof window === 'undefined') return null;

        // DEBUG: List all keys to diagnose production environment differences
        const allKeys = Object.keys(localStorage);
        const sbKeys = allKeys.filter(k => k.includes('sb-'));

        // Derive Supabase project ID from URL for dynamic cookie discovery
        const supabaseUrl = ENV.VITE_SUPABASE_URL || '';
        const projectId = supabaseUrl.split('.')[0].split('//').pop();

        console.log('[AuthContext] Debug: Storage Inspection', {
            allKeysCount: allKeys.length,
            sbKeys: sbKeys,
            projectId,
            cookiesPresent: !!document.cookie,
            url: window.location.href
        });

        let raw: string | null = null;
        let source: 'localStorage' | 'cookie' = 'localStorage';

        // 1. Try Local Storage first (standard client-side behavior)
        const storageKey = allKeys.find(
            (k) => (k.startsWith('sb-') || k.includes('-auth-token')) && k.endsWith('-auth-token')
        );

        if (storageKey) {
            raw = localStorage.getItem(storageKey);
        }

        // 2. Try Cookies if Local Storage failed (standard SSR behavior / Google Sign-In)
        if (!raw) {
            // Supabase auth cookies follow sb-PROJECT_ID-auth-token
            // Derive name dynamicially or fallback to known production ID
            const targetCookie = projectId ? `sb-${projectId}-auth-token` : 'sb-ehekzoioqvtweugemktn-auth-token';
            raw = getCookie(targetCookie);

            if (raw) {
                source = 'cookie';
                console.log('[AuthContext] Debug: Found session in target cookie', { targetCookie });
            } else {
                // FALLBACK: Generic discovery across any cookie mentioning auth-token
                if (typeof document !== 'undefined' && document.cookie) {
                    const allCookies = document.cookie.split(';').map(c => c.trim().split('=')[0]);
                    const cookieKey = allCookies.find(k =>
                        (k.includes('auth-token') || k.startsWith('sb-')) &&
                        !k.includes('verifier') && // Avoid verifier cookies
                        !k.includes('pkce') // Avoid PKCE cookies
                    );

                    if (cookieKey) {
                        raw = getCookie(cookieKey);
                        source = 'cookie';
                        console.log('[AuthContext] Debug: Found session in generic cookie discovery', { cookieKey });
                    }
                }
            }
        }

        if (!raw) {
            const isAuthFlow = window.location.pathname.includes('/auth/');
            if (!isAuthFlow) {
                console.warn('[AuthContext] Debug: No supabase token found in localStorage or cookies');
            }
            return null;
        }

        let session: any = null;
        try {
            // Check if it's already an object (SSR might pass it this way)
            if (typeof raw === 'object' && raw !== null) {
                session = (raw as any).currentSession ?? raw;
            } else {
                const parsed = JSON.parse(raw);
                session = parsed?.currentSession ?? parsed;
            }
        } catch (e) {
            // If it's not JSON, it's likely a non-session cookie or corrupted data.
            // Using debug instead of warn to reduce console noise for non-session cookies.
            console.debug('[AuthContext] Debug: Cookie/Storage data is not valid JSON (skipping)', {
                source,
                preview: typeof raw === 'string' ? raw.substring(0, 20) + '...' : 'non-string'
            });
            return null;
        }

        // VALIDATION: Ensure it's actually a session object
        if (!session?.user || !session?.access_token) {
            console.warn('[AuthContext] Debug: Invalid session structure', {
                source,
                hasUser: !!session?.user,
                hasToken: !!session?.access_token
            });
            return null;
        }

        // Check expiry (Unix timestamp in seconds)
        const expiresAt = session.expires_at;
        if (expiresAt && Date.now() / 1000 > expiresAt) {
            console.warn('[AuthContext] Debug: Session token expired', {
                source,
                expiresAt,
                now: Math.floor(Date.now() / 1000)
            });
            return null;
        }

        console.log(`[AuthContext] Debug: Optimistic read success from ${source}`, {
            userId: session.user.id,
            email: session.user.email
        });

        const { user } = session;
        const metadata = user.user_metadata || {};

        return {
            id: user.id,
            email: user.email || '',
            name: metadata.name || metadata.full_name || user.email?.split('@')[0] || 'User',
            role: metadata.role || 'tenant_admin',
            avatar: metadata.avatar || metadata.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`,
            account_status: metadata.account_status || 'active',
            scheduled_deletion_at: metadata.scheduled_deletion_at,
        };
    } catch (e) {
        console.error('[AuthContext] Debug: Error reading session from storage', e);
        return null;
    }
}


/**
 * Clear all Supabase auth tokens from localStorage AND cookies.
 * Called before signOut to ensure the session is fully cleared.
 */
function clearAuthSession() {
    try {
        if (typeof window === 'undefined') return;

        // 1. Clear LocalStorage
        const keys = Object.keys(localStorage).filter(
            (k) => (k.startsWith('sb-') || k.includes('auth-token'))
        );
        keys.forEach((k) => localStorage.removeItem(k));

        // 2. Clear Cookies (set expiry to past)
        if (typeof document !== 'undefined') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i];
                const eqPos = cookie.indexOf('=');
                const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                if (name.includes('auth-token') || name.startsWith('sb-')) {
                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
                    // Also try domain-scoped if needed
                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
                }
            }
        }
    } catch {
        // ignore
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Track whether we've already done the optimistic read to avoid double-render
    const didOptimisticRead = useRef(false);
    // Track the latest user state to prevent race conditions between initSession and onAuthStateChange
    const latestUserRef = useRef<User | null>(null);

    // Wrapper to set user and update ref
    const setSafeUser = (u: User | null) => {
        latestUserRef.current = u;
        setUser(u);
    };

    useEffect(() => {
        let isMounted = true;

        // STEP 1: Synchronously read localStorage for instant render.
        // This runs inside useEffect so it reads the CURRENT localStorage state
        // (not a stale closure from render time). This is what makes logout work correctly.
        if (!didOptimisticRead.current) {
            didOptimisticRead.current = true;
            const cachedUser = readSessionFromStorage();
            if (cachedUser && isMounted) {
                console.log('[AuthContext] Found cached user in storage, setting immediately');
                setSafeUser(cachedUser);
                setLoading(false);
            } else {
                // If no cached user, we don't set loading to false yet.
                // We wait for initSession (async validation) to finish.
                console.log('[AuthContext] No cached user found, waiting for async validation...');
            }
        }

        // STEP 2: Async validation — always runs to confirm session is still valid.
        const initSession = async () => {
            try {
                const { user: validatedUser, error: authError } = await authService.getCurrentUser();

                if (!isMounted) return;

                if (authError) {
                    console.error('[AuthContext] Debug: getCurrentUser returned error', authError);

                    // CRITICAL FIX: Only clear the session if it's a definitive auth failure.
                    // Network errors or transient server issues should NOT trigger a logout.
                    const isAuthError = authError.toLowerCase().includes('invalid') ||
                        authError.toLowerCase().includes('expired') ||
                        authError.toLowerCase().includes('unauthorized') ||
                        authError.toLowerCase().includes('not found');

                    if (isAuthError) {
                        // Session invalid or expired — always clear user
                        clearAuthSession();
                        setSafeUser(null);
                        setError(authError);
                    } else {
                        console.warn('[AuthContext] Debug: Possible transient error. Retaining current state.');
                    }
                } else if (validatedUser) {
                    setSafeUser(validatedUser);
                    setError(null);
                } else {
                    // RACE CONDITION FIX: If onAuthStateChange already found a user, don't overwrite with null
                    if (!latestUserRef.current) {
                        // Session invalid or expired — always clear user
                        clearAuthSession();
                        setSafeUser(null);
                        setError(null);
                    }
                }
            } catch (e) {
                if (!isMounted) return;
                console.error('[AuthContext] Debug: initSession caught exception', e);

                // RACE CONDITION FIX for exception case
                if (!latestUserRef.current) {
                    setSafeUser(null);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        // STEP 2: Async validation / Subscriber
        // We rely on onAuthStateChange for the initial session event
        const { data: { subscription } } = authService.onAuthStateChange(async (u: User | null, event?: AuthChangeEvent) => {
            if (!isMounted) return;

            console.log(`[AuthContext] Auth State Event: ${event}`, { hasUser: !!u });

            if (u) {
                setSafeUser(u);
                setError(null);
                setLoading(false);
            } else if (event === 'SIGNED_OUT') {
                setSafeUser(null);
                setError(null);
                setLoading(false);
            } else if (event === 'INITIAL_SESSION') {
                // Wait for the authService.getCurrentUser() call inside onAuthStateChange to resolve
                // but if u is null here and it's INITIAL_SESSION, we might want to trigger a manual init 
                // ONLY if we haven't found a user yet.
                if (!u && !latestUserRef.current) {
                    console.log('[AuthContext] INITIAL_SESSION returned no user, performing manual validation...');
                    initSession();
                }
            } else if (event === 'TOKEN_REFRESHED') {
                return;
            } else if (!u) {
                setSafeUser(null);
                setLoading(false);
            }
        });

        // Optional: Manual init as a backup to onAuthStateChange
        // Some browser environments or SDK versions don't reliably fire INITIAL_SESSION
        const runBackupInit = setTimeout(() => {
            if (isMounted && !latestUserRef.current) {
                console.log('[AuthContext] Backup init triggered (3s grace)...');
                initSession();
            }
        }, 3000);

        // Safety net: force stop loading after 8s — only stops the spinner, does NOT clear the user.
        // Extended from 3s to give Supabase async validation more time before the dashboard
        // decides there is no session and redirects.
        const safetyTimeout = setTimeout(() => {
            if (isMounted) {
                console.warn('[AuthContext] Safety timeout reached (8s). Forcing loading to false. If user state exists it is preserved.');
                setLoading(false);
            }
        }, 8000);

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            clearTimeout(safetyTimeout);
            clearTimeout(runBackupInit);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const signOut = async () => {
        // Clear auth tokens FIRST so any refresh during sign-out doesn't re-read stale session
        clearAuthSession();
        setSafeUser(null);
        setLoading(false);
        await authService.signOut();
    };

    const cancelAccountDeletion = async () => {
        const { error } = await authService.cancelAccountDeletion();
        if (!error) {
            // Re-fetch to update state
            const { user: refreshedUser } = await authService.getCurrentUser();
            setSafeUser(refreshedUser);
        }
        return { error };
    };

    return (
        <AuthContext.Provider value={{ user, loading, error, signOut, cancelAccountDeletion }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
