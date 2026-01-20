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
                // Check for ghost user simulation first
                const ghostUserStr = localStorage.getItem('alphaclone_ghost_user');
                if (ghostUserStr) {
                    try {
                        const ghostUser = JSON.parse(ghostUserStr);
                        setUser(ghostUser);
                        setLoading(false);
                        console.log('Ghost Mode Active in AuthContext');
                        return; // Ghost mode overrides real session for UI
                    } catch (e) {
                        console.error('Failed to parse ghost user:', e);
                        localStorage.removeItem('alphaclone_ghost_user');
                    }
                }

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
            // Only update if not in ghost mode (ghost mode is manual exit)
            if (!localStorage.getItem('alphaclone_ghost_user')) {
                console.log(`AuthContext: Handling ${event} event, User: ${u?.email}`);

                // If we just signed in, we might be about to redirect. 
                // Ensure we are in a loading state while the profile is fetched.
                if (event === 'SIGNED_IN' && !u) {
                    setLoading(true);
                } else {
                    setUser(u);
                    setLoading(false);
                }
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        localStorage.removeItem('alphaclone_ghost_user');
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
