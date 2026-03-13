'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import { AuthChangeEvent } from '@supabase/supabase-js';


interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    mfaLevel: 'aal1' | 'aal2' | null;
    needsMfa: boolean;
    signOut: () => Promise<void>;
    cancelAccountDeletion: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);





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
    const [mfaLevel, setMfaLevel] = useState<'aal1' | 'aal2' | null>(null);
    const [needsMfa, setNeedsMfa] = useState(false);
    // Track the latest user state to prevent race conditions between initSession and onAuthStateChange
    const latestUserRef = useRef<User | null>(null);

    // Fetch and set MFA level
    // Fetch and set MFA level - wrapped in timeout to prevent blocking init
    const refreshMfaLevel = async () => {
        try {
            // Add a 3s timeout to the MFA check
            const mfaPromise = supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('MFA check timeout')), 3000));

            const { data, error } = await Promise.race([mfaPromise, timeoutPromise]) as any;

            if (error) {
                console.error('[AuthContext] Error getting MFA level:', error);
                return;
            }
            console.log('[AuthContext] MFA Level:', data);
            setMfaLevel(data.currentLevel as 'aal1' | 'aal2');
            setNeedsMfa(data.nextLevel === 'aal2' && data.currentLevel !== 'aal2');
        } catch (err) {
            console.error('[AuthContext] MFA level fetch suppressed or timed out:', err);
        }
    };

    // Wrapper to set user and update ref
    const setSafeUser = (u: User | null) => {
        latestUserRef.current = u;
        setUser(u);
    };

    useEffect(() => {
        let isMounted = true;

        // Async validation — runs to confirm/retrieve session from Supabase.
        // This correctly reads sessions from HTTP-only cookies (set by the SSR callback
        // after Google OAuth) as well as localStorage sessions (email/password sign-in).
        const initSession = async () => {
            try {
                const { user: validatedUser, error: authError } = await authService.getCurrentUser();

                if (!isMounted) return;

                if (authError) {
                    // Silently ignore abort/cancel — happens in React StrictMode dev double-mount
                    const isAbort = authError.toLowerCase().includes('abort') ||
                        authError.toLowerCase().includes('cancel') ||
                        authError.toLowerCase().includes('signal');
                    if (isAbort) {
                        console.log('[AuthContext] Auth request aborted (expected in dev StrictMode). Retaining current state.');
                        return;
                    }

                    console.error('[AuthContext] Debug: getCurrentUser returned error', authError);

                    const isAuthError = authError.toLowerCase().includes('invalid') ||
                        authError.toLowerCase().includes('expired') ||
                        authError.toLowerCase().includes('unauthorized') ||
                        authError.toLowerCase().includes('not found');

                    if (isAuthError) {
                        clearAuthSession();
                        setSafeUser(null);
                        setError(authError);
                    } else {
                        console.warn('[AuthContext] Debug: Possible transient error. Retaining current state.', authError);
                    }
                } else if (validatedUser) {
                    setSafeUser(validatedUser);
                    setError(null);
                    await refreshMfaLevel();
                } else {
                    // RACE CONDITION FIX: If onAuthStateChange already found a user, don't overwrite with null
                    if (!latestUserRef.current) {
                        setSafeUser(null);
                        setError(null);
                    }
                }
            } catch (e: any) {
                if (!isMounted) return;
                console.error('[AuthContext] Debug: initSession caught exception', e);

                if (e.name !== 'AbortError' && !e.message?.includes('abort')) {
                    if (!latestUserRef.current) {
                        setSafeUser(null);
                    }
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        // Primary: rely on onAuthStateChange for session events.
        // INITIAL_SESSION fires with the current session (including sessions stored in
        // HTTP-only cookies from the Google OAuth callback route).
        const { data: { subscription } } = authService.onAuthStateChange(async (u: User | null, event?: AuthChangeEvent) => {
            if (!isMounted) return;

            console.log(`[AuthContext] Auth State Event: ${event}`, { hasUser: !!u });

            if (u) {
                setSafeUser(u);
                setError(null);
                setLoading(false);
                refreshMfaLevel();
            } else if (event === 'SIGNED_OUT') {
                setSafeUser(null);
                setError(null);
                setMfaLevel(null);
                setNeedsMfa(false);
                setLoading(false);
            } else if (event === 'INITIAL_SESSION') {
                // Check if we are in an auth callback flow
                const isAuthCallback = typeof window !== 'undefined' && (
                    window.location.search.includes('code=') ||
                    window.location.pathname.includes('/auth/callback') ||
                    sessionStorage.getItem('auth_callback_in_progress') === 'true'
                );

                if (!u && !latestUserRef.current) {
                    if (isAuthCallback) {
                        console.log('[AuthContext] INITIAL_SESSION: No user yet but auth callback in progress, holding loading state...');
                        setLoading(true);
                    } else {
                        console.log('[AuthContext] INITIAL_SESSION returned no user, performing manual validation...');
                        initSession();
                    }
                } else if (!u) {
                    // No user and no callback — stop the loading spinner
                    setLoading(false);
                }
            } else if (event === 'TOKEN_REFRESHED') {
                return;
            } else if (!u) {
                setSafeUser(null);
                setLoading(false);
            }
        });

        // Backup: if onAuthStateChange doesn't fire INITIAL_SESSION within 2s, run manually.
        // This handles edge cases in some browser/SDK versions.
        const runBackupInit = setTimeout(() => {
            if (isMounted && !latestUserRef.current) {
                console.log('[AuthContext] Backup init triggered (2s grace)...');
                initSession();
            }
        }, 2000);

        // Safety net: force stop loading after 8s (reduced from 10s for better DX).
        // Only stops the spinner, does NOT clear the user state.
        // Safety net: force stop loading after 4s (reduced from 8s).
        // Only stops the spinner, does NOT clear the user state.
        const safetyTimeout = setTimeout(() => {
            if (isMounted && loading) {
                console.warn('[AuthContext] Safety timeout reached (4s). Forcing loading to false.');
                setLoading(false);
            }
        }, 4000);

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
        <AuthContext.Provider value={{ user, loading, error, mfaLevel, needsMfa, signOut, cancelAccountDeletion }}>
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
