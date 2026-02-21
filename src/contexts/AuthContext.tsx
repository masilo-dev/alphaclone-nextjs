'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ... (existing imports and interface)

/**
 * Read the Supabase session from localStorage synchronously.
 * Called INSIDE useEffect so it always reads the current state of localStorage
 * (not a stale closure from render time — this is critical for logout to work).
 */
function readSessionFromStorage(): User | null {
    try {
        if (typeof window === 'undefined') return null;

        // DEBUG: List all keys to diagnose production environment differences
        const allKeys = Object.keys(localStorage);
        const sbKeys = allKeys.filter(k => k.includes('sb-'));

        console.log('[AuthContext] Debug: Storage Inspection', {
            allKeysCount: allKeys.length,
            sbKeys: sbKeys,
            url: window.location.href
        });

        // OPTIMIZED: Match precisely the auth token to avoid matching -code-verifier strings
        // This is more robust than just checking for 'sb-' prefixes
        const storageKey = allKeys.find(
            (k) => (k.startsWith('sb-') || k.includes('-auth-token')) && k.endsWith('-auth-token')
        );

        if (!storageKey) {
            // FALLBACK: Try a broader search if exact match fails
            const fallbackKey = allKeys.find(k => k.includes('auth-token'));
            if (fallbackKey) {
                console.log('[AuthContext] Debug: Found key via broad fallback', fallbackKey);
            } else {
                // IMPORTANT: If we are on the auth callback page, it's NORMAL not to have a token yet in localStorage
                // as it might be stored in cookies by @supabase/ssr
                const isAuthFlow = window.location.pathname.includes('/auth/');
                if (!isAuthFlow) {
                    console.warn('[AuthContext] Debug: No supabase token found in localStorage among keys:', allKeys.filter(k => k.length < 50));
                }
                return null;
            }
        }

        const effectiveKey = storageKey || allKeys.find(k => k.includes('auth-token'))!;
        const raw = localStorage.getItem(effectiveKey);

        if (!raw) {
            console.warn('[AuthContext] Debug: Found key but value is empty', effectiveKey);
            return null;
        }

        const parsed = JSON.parse(raw);
        // Supabase stores it either directly or under 'currentSession'
        const session = parsed?.currentSession ?? parsed;

        // VALIDATION: Ensure it's actually a session object
        if (!session?.user || !session?.access_token) {
            console.warn('[AuthContext] Debug: Invalid session structure', {
                hasUser: !!session?.user,
                hasToken: !!session?.access_token,
                keys: Object.keys(session || {})
            });
            return null;
        }

        // Check expiry (Unix timestamp in seconds)
        const expiresAt = session.expires_at;
        if (expiresAt && Date.now() / 1000 > expiresAt) {
            console.warn('[AuthContext] Debug: Session token expired', {
                expiresAt,
                now: Math.floor(Date.now() / 1000),
                diff: Math.floor(Date.now() / 1000 - expiresAt)
            });
            return null;
        }

        console.log('[AuthContext] Debug: Optimistic read success', {
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
        };
    } catch (e) {
        console.error('[AuthContext] Debug: Error reading session from storage', e);
        return null;
    }
}


/**
 * Clear all Supabase auth tokens from localStorage.
 * Called before signOut to ensure the session is fully cleared.
 */
function clearStorageSession() {
    try {
        if (typeof window === 'undefined') return;
        const keys = Object.keys(localStorage).filter(
            (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
        );
        keys.forEach((k) => localStorage.removeItem(k));
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
                        console.warn('[AuthContext] Debug: Definitive auth failure. Clearing session.');
                        clearStorageSession();
                        setSafeUser(null);
                        setError(authError);
                    } else {
                        console.warn('[AuthContext] Debug: Possible transient error. Retaining current session state.');
                        // If we already have a cached user, we keep it rather than logging out.
                        if (!latestUserRef.current) {
                            setError(authError);
                        }
                    }
                    setLoading(false);
                    return;
                }

                if (validatedUser) {
                    setSafeUser(validatedUser);
                    setError(null);
                    setLoading(false);
                } else {
                    // RACE CONDITION FIX:
                    // If onAuthStateChange already found a user (via latestUserRef), DO NOT overwrite it with null
                    if (latestUserRef.current) {
                        // We trust the listener more than the REST check in this race case
                        return;
                    }

                    // Session invalid or expired — always clear user
                    clearStorageSession();
                    setSafeUser(null);
                    setError(null);
                    setLoading(false);
                }
            } catch (e) {
                if (!isMounted) return;
                if (e instanceof Error && e.name === 'AbortError') return;

                // RACE CONDITION FIX for exception case
                if (latestUserRef.current) {
                    return;
                }

                setSafeUser(null);
                setLoading(false);
            }
        };

        initSession();

        // STEP 3: Subscribe to auth state changes
        const { data: { subscription } } = authService.onAuthStateChange((u, event) => {
            if (!isMounted) return;

            if (u) {
                setSafeUser(u);
                setError(null);
                setLoading(false);
            } else if (event === 'SIGNED_OUT') {
                setSafeUser(null);
                setError(null);
                setLoading(false);
            } else if (event === 'INITIAL_SESSION' && !u) {
                // Let initSession() handle this case
                return;
            } else if (event === 'TOKEN_REFRESHED') {
                // Don't clear user on token refresh
                return;
            } else if (!u) {
                setSafeUser(null);
                setLoading(false);
            }
        });

        // Safety net: force stop loading after 8s (increased from 5s for slower production cold starts)
        const safetyTimeout = setTimeout(() => {
            if (isMounted && loading) {
                console.warn('[AuthContext] Safety timeout reached, forcing loading to false');
                setLoading(false);
            }
        }, 8000);

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            clearTimeout(safetyTimeout);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const signOut = async () => {
        // Clear localStorage FIRST so any refresh during sign-out doesn't re-read stale session
        clearStorageSession();
        setSafeUser(null);
        setLoading(false);
        await authService.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, loading, error, signOut }}>
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
