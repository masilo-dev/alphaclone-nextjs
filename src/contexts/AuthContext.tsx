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

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        // OPTIMIZATION: Immediate session check with Grace Period
        const initSession = async () => {
            try {
                // Check if we have a session immediately
                const { user: initialUser, error: authError } = await authService.getCurrentUser();

                if (authError) {
                    // Ignore abort errors
                    if (authError.includes('aborted') || authError.includes('AbortError')) {
                        return;
                    }
                    console.error('AuthContext: Session init error', authError);
                    setError(authError);
                    setLoading(false);
                    return;
                }

                if (isMounted) {
                    if (initialUser) {
                        console.log('AuthContext: Optimistic session found', initialUser.email);
                        setUser(initialUser);
                        setError(null);
                        setLoading(false);
                    } else {
                        // DOUBLE CHECK: If no user found, wait a moment and check again
                        // This handles race conditions where the storage sync is slightly slower than the render
                        // OPTIMIZATION: Immediate retry with parallel check
                        console.log('AuthContext: No initial session, checking again immediately...');

                        // Parallel check: Try to restore session immediately while setting up the timeout backup
                        const immediateCheck = authService.getCurrentUser().then(({ user }) => {
                            if (user && isMounted && loading) {
                                console.log('AuthContext: Immediate parallel check found user!');
                                setUser(user);
                                setError(null);
                                setLoading(false);
                            }
                        });

                        // Fire immediately (0ms) — parallel check already handles the race condition
                        setTimeout(async () => {
                            if (!isMounted) return;
                            await immediateCheck; // Ensure we don't race with the immediate check

                            if (!loading && user) return; // Already found

                            // Re-check
                            const { data: { session } } = await import('../lib/supabase').then(m => m.supabase.auth.getSession());
                            if (session?.user) {
                                console.log('AuthContext: Session found on second attempt!');
                                const { user: retryUser } = await authService.getCurrentUser();
                                if (retryUser && isMounted) {
                                    setUser(retryUser);
                                    setError(null);
                                }
                            } else {
                                console.log('AuthContext: Confirmed no session.');
                            }
                            if (isMounted) setLoading(false);
                        }, 0);
                    }
                }
            } catch (e) {
                // Ignore AbortErrors
                if (e instanceof Error && e.name === 'AbortError') return;

                console.warn('AuthContext: Optimistic check failed', e);
                setError(e instanceof Error ? e.message : 'Authentication failed');
                setLoading(false);
            }
        };

        initSession();

        // Subscribe to auth changes
        const { data: { subscription } } = authService.onAuthStateChange((u, event) => {
            if (!isMounted) return;
            console.log(`AuthContext: Handling ${event} event, User: ${u?.email}`);

            // OPTIMIZATION: Prevent unnecessary state updates (flip-flopping)
            // If we already have the same user loaded, ignores INITIAL_SESSION or SIGNED_IN events
            if (u && user && u.id === user.id && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
                console.log('AuthContext: User already loaded, skipping update');
                return;
            }

            if (u) {
                // User is authenticated and profile is loaded
                setUser(u);
                setError(null);
                setLoading(false);
            } else if (event === 'SIGNED_OUT') {
                // Explicit sign out
                setUser(null);
                setError(null);
                setLoading(false);
            } else if (event === 'INITIAL_SESSION' && !u) {
                // If INITIAL_SESSION fires with no user, we still wait for our 800ms retry to finish
                // unless we've already decided loading is false.
                // This is the key change to prevent early loading: false.
                console.log('AuthContext: INITIAL_SESSION event with no user, waiting for retry logic...');
            } else if (event === 'SIGNED_IN' && !u) {
                // Signed in but no user data (shouldn't happen with our wrapper, but safe fallback)
                setUser(null);
                setLoading(false);
            } else {
                // Don't clear user if we're just refreshing session token!
                if (event === 'TOKEN_REFRESHED' && user) {
                    return;
                }

                // Fallback for other events
                if (!u && event !== 'TOKEN_REFRESHED') {
                    setUser(null);
                    setLoading(false);
                }
            }
        });

        // SAFETY NET: Force stop loading after 5 seconds to preventing hanging
        const safetyTimeout = setTimeout(() => {
            if (isMounted && loading) {
                console.warn('AuthContext: Safety timeout triggered (5s), forcing loading completion');
                setLoading(false);
            }
        }, 5000);

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            clearTimeout(safetyTimeout);
        };
    }, []);

    const signOut = async () => {

        await authService.signOut();
        setUser(null);
    };

    const value = {
        user,
        loading,
        error,
        signOut
    };

    return (
        <AuthContext.Provider value={value}>
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
