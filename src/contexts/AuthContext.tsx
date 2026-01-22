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

        // Session is now handled server-side by /auth/callback route
        // Client only needs to listen for the session change
        // const handleAuthCallback = ... (removed to prevent race conditions)

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
