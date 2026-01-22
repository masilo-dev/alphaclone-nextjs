'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Initial session check
        const initAuth = async () => {
            try {
                // Check for session
                const { user: currentUser } = await authService.getCurrentUser();
                setUser(currentUser);
            } catch (err) {
                console.error('Auth initialization error:', err);
            } finally {
                setLoading(false);
            }
        };

        initAuth();

        // Subscribe to auth changes
        const { data: { subscription } } = authService.onAuthStateChange((u, event) => {
            if (true) {
                console.log(`AuthContext: Handling ${event} event, User: ${u?.email}`);

                // If we just signed in, we might be about to redirect. 
                // Ensure we are in a loading state while the profile is fetched.
                if (event === 'SIGNED_IN' && !u) {
                    setLoading(true);
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setLoading(false);
                } else {
                    setUser(u);
                    setLoading(false);
                }
            }
        });

        // SAFETY NET: Check for OAuth code in URL and manually exchange it if session is missing
        // This fixes the issue where Google redirect happens but session isn't established automatically
        const handleAuthCallback = async () => {
            if (typeof window !== 'undefined') {
                const searchParams = new URLSearchParams(window.location.search);
                const code = searchParams.get('code');

                if (code && !user) {
                    console.log('AuthContext: Found OAuth code in URL, attempting manual exchange...');
                    setLoading(true);

                    try {
                        const { supabase } = await import('../lib/supabase');
                        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

                        if (error) {
                            console.error('AuthContext: Manual code exchange failed:', error);
                            setLoading(false);
                        } else if (data.session) {
                            console.log('AuthContext: Manual code exchange SUCCESS! Session established.');
                            // The onAuthStateChange listener will pick this up and set the user
                            // Clean up URL
                            const newUrl = window.location.pathname;
                            window.history.replaceState({}, document.title, newUrl);
                        }
                    } catch (err) {
                        console.error('AuthContext: Unexpected error during code exchange:', err);
                        setLoading(false);
                    }
                }
            }
        };

        handleAuthCallback();

        return () => {
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
