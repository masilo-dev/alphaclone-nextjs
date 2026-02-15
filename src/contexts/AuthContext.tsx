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

                if (isMounted && initialUser) {
                    console.log('AuthContext: Optimistic session found', initialUser.email);
                    setUser(initialUser);
                    setError(null);
                    setLoading(false);
                } else if (isMounted && !initialUser) {
                    // DOUBLE CHECK: If no user found, wait a moment and check again
                    // This handles race conditions where the storage sync is slightly slower than the render
                    console.log('AuthContext: No initial session, checking again in 500ms...');
                    setTimeout(async () => {
                        if (!isMounted) return;

                        // Re-check
                        const { data: { session } } = await import('../lib/supabase').then(m => m.supabase.auth.getSession());
                        if (session?.user) {
                            console.log('AuthContext: Session found on second attempt!');
                            const { user: retryUser } = await authService.getCurrentUser();
                            if (retryUser) {
                                setUser(retryUser);
                                setError(null);
                            }
                        } else {
                            console.log('AuthContext: Confirmed no session.');
                        }
                        setLoading(false);
                    }, 500);
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
                setLoading(false);
            } else if (event === 'SIGNED_IN' && !u) {
                // Signed in but no user data (shouldn't happen with our wrapper, but safe fallback)
                setUser(null);
                setLoading(false);
            } else {
                // Initial session check or other events where no user is present
                // Don't clear user if we're just refreshing session token!
                if (event === 'TOKEN_REFRESHED' && user) {
                    return;
                }

                // Only clear if we didn't find an optimistic user earlier or if this is an explicit no-session event
                if (event === 'INITIAL_SESSION' && !u) {
                    setUser(null);
                    setLoading(false);
                }
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
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
