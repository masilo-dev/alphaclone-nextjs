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

/**
 * Read the Supabase session from localStorage synchronously.
 * Called INSIDE useEffect so it always reads the current state of localStorage
 * (not a stale closure from render time — this is critical for logout to work).
 */
function readSessionFromStorage(): User | null {
    try {
        if (typeof window === 'undefined') return null;

        const storageKey = Object.keys(localStorage).find(
            (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
        );
        if (!storageKey) return null;

        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        const session = parsed?.currentSession ?? parsed;

        if (!session?.user || !session?.access_token) return null;

        // Check expiry (Unix timestamp in seconds)
        const expiresAt = session.expires_at;
        if (expiresAt && Date.now() / 1000 > expiresAt) return null;

        const { user } = session;
        const metadata = user.user_metadata || {};

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

    useEffect(() => {
        let isMounted = true;

        // STEP 1: Synchronously read localStorage for instant render.
        // This runs inside useEffect so it reads the CURRENT localStorage state
        // (not a stale closure from render time). This is what makes logout work correctly.
        if (!didOptimisticRead.current) {
            didOptimisticRead.current = true;
            const cachedUser = readSessionFromStorage();
            if (cachedUser && isMounted) {
                setUser(cachedUser);
                setLoading(false);
            }
        }

        // STEP 2: Async validation — always runs to confirm session is still valid.
        const initSession = async () => {
            try {
                const { user: validatedUser, error: authError } = await authService.getCurrentUser();

                if (!isMounted) return;

                if (authError) {
                    if (authError.includes('aborted') || authError.includes('AbortError')) return;
                    console.error('AuthContext: Session validation error', authError);
                    setUser(null);
                    setError(authError);
                    setLoading(false);
                    return;
                }

                if (validatedUser) {
                    setUser(validatedUser);
                    setError(null);
                    setLoading(false);
                } else {
                    // Session invalid or expired — always clear user
                    setUser(null);
                    setError(null);
                    setLoading(false);
                }
            } catch (e) {
                if (!isMounted) return;
                if (e instanceof Error && e.name === 'AbortError') return;
                console.warn('AuthContext: Session validation failed', e);
                setUser(null);
                setLoading(false);
            }
        };

        initSession();

        // STEP 3: Subscribe to auth state changes
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
            } else if (event === 'INITIAL_SESSION' && !u) {
                // Let initSession() handle this case
                return;
            } else if (event === 'TOKEN_REFRESHED') {
                // Don't clear user on token refresh
                return;
            } else if (!u) {
                setUser(null);
                setLoading(false);
            }
        });

        // Safety net: force stop loading after 5s
        const safetyTimeout = setTimeout(() => {
            if (isMounted) {
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
        // Clear localStorage FIRST so any refresh during sign-out doesn't re-read stale session
        clearStorageSession();
        setUser(null);
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
