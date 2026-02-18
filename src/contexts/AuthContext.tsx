'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Attempt to read the Supabase session from localStorage synchronously.
 * Supabase SSR stores the session under a key like:
 *   sb-<project-ref>-auth-token
 * We scan for any key matching that pattern.
 *
 * Returns a partial User if a valid, non-expired session is found, otherwise null.
 */
function getOptimisticUserFromStorage(): User | null {
    try {
        if (typeof window === 'undefined') return null;

        // Find the Supabase auth token key (pattern: sb-*-auth-token)
        const storageKey = Object.keys(localStorage).find(
            (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
        );
        if (!storageKey) return null;

        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        // Support both direct session object and wrapped { currentSession, ... } format
        const session = parsed?.currentSession ?? parsed;

        if (!session?.user || !session?.access_token) return null;

        // Check expiry — Supabase stores expires_at as a Unix timestamp (seconds)
        const expiresAt = session.expires_at;
        if (expiresAt && Date.now() / 1000 > expiresAt) {
            // Session is expired — don't optimistically render
            return null;
        }

        const { user } = session;
        const metadata = user.user_metadata || {};

        // Build a partial User from the cached session data
        return {
            id: user.id,
            email: user.email || '',
            name: metadata.name || metadata.full_name || user.email?.split('@')[0] || 'User',
            role: metadata.role || 'tenant_admin',
            avatar: metadata.avatar || metadata.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`,
        };
    } catch {
        return null;
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    // OPTIMIZATION: Read session from localStorage synchronously so we can
    // start with loading=false if we already have a valid cached session.
    // This eliminates the skeleton flash on page refresh.
    const optimisticUser = getOptimisticUserFromStorage();

    const [user, setUser] = useState<User | null>(optimisticUser);
    const [loading, setLoading] = useState(!optimisticUser); // Only show loading if no cached session
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const initSession = async () => {
            try {
                // Always validate the session in the background, even if we have an optimistic user.
                // This ensures the session is still valid and updates user data if needed.
                const { user: validatedUser, error: authError } = await authService.getCurrentUser();

                if (!isMounted) return;

                if (authError) {
                    if (authError.includes('aborted') || authError.includes('AbortError')) return;
                    console.error('AuthContext: Session validation error', authError);
                    // Only clear user and show error if we didn't have an optimistic user
                    if (!optimisticUser) {
                        setError(authError);
                        setLoading(false);
                    }
                    return;
                }

                if (validatedUser) {
                    // Update with the fully validated user (may have fresher data than localStorage)
                    setUser(validatedUser);
                    setError(null);
                    setLoading(false);
                } else {
                    // No valid session — clear the optimistic user if we had one
                    if (optimisticUser) {
                        console.log('AuthContext: Optimistic session was stale, clearing user');
                    }
                    setUser(null);
                    setError(null);
                    setLoading(false);
                }
            } catch (e) {
                if (!isMounted) return;
                if (e instanceof Error && e.name === 'AbortError') return;
                console.warn('AuthContext: Session validation failed', e);
                if (!optimisticUser) {
                    setError(e instanceof Error ? e.message : 'Authentication failed');
                    setLoading(false);
                }
            }
        };

        initSession();

        // Subscribe to auth state changes
        const { data: { subscription } } = authService.onAuthStateChange((u, event) => {
            if (!isMounted) return;
            console.log(`AuthContext: ${event} event, User: ${u?.email}`);

            if (u) {
                setUser(u);
                setError(null);
                setLoading(false);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setError(null);
                setLoading(false);
            } else if (event === 'TOKEN_REFRESHED' && user) {
                // Don't clear user on token refresh
                return;
            } else if (event === 'INITIAL_SESSION' && !u) {
                // INITIAL_SESSION with no user — let initSession() handle it
                return;
            } else if (!u && event !== 'TOKEN_REFRESHED') {
                setUser(null);
                setLoading(false);
            }
        });

        // Safety net: force stop loading after 5s to prevent hanging
        const safetyTimeout = setTimeout(() => {
            if (isMounted && loading) {
                console.warn('AuthContext: Safety timeout (5s), forcing loading completion');
                setLoading(false);
            }
        }, 5000);

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            clearTimeout(safetyTimeout);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const signOut = async () => {
        await authService.signOut();
        setUser(null);
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
