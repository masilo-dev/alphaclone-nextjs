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
        // Subscribe to auth changes
        const { data: { subscription } } = authService.onAuthStateChange((u, event) => {
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
                setUser(null);
                setLoading(false);
            }
        });

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
