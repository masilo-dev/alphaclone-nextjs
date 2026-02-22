'use client';

import React, { useState, useEffect } from 'react';
import Dashboard from '@/components/Dashboard';
import { Project, ChatMessage, GalleryItem } from '@/types';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardShellSkeleton } from '@/components/ui/TabSkeleton';

export default function DashboardPage() {
    const { user, loading, signOut } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
    const router = useRouter();

    const [isGracePeriod, setIsGracePeriod] = useState(true);

    useEffect(() => {
        // Stop checking if user exists
        if (user) {
            setIsGracePeriod(false);
            return;
        }

        // If loading is done and no user exists, start grace period
        if (!loading && !user) {
            // Resilient token discovery: check for any Supabase auth token (localStorage OR cookies)
            const hasLocalToken = typeof window !== 'undefined' && (
                Object.keys(localStorage).some(k => k.includes('auth-token') || k.startsWith('sb-')) ||
                document.cookie.includes('auth-token') ||
                document.cookie.includes('sb-')
            );

            // Check if we are in an auth callback flow
            const isAuthCallback = typeof window !== 'undefined' && (
                window.location.search.includes('code=') ||
                window.location.pathname.includes('/auth/callback') ||
                sessionStorage.getItem('auth_callback_in_progress') === 'true'
            );

            // Grace period based on probable presence of session. 
            // In callback or redirect flows, we give it much more time (8s) before failing.
            const timeoutDuration = isAuthCallback ? 8000 : (hasLocalToken ? 2500 : 2000);

            console.log(`DashboardPage: User missing, starting grace period of ${timeoutDuration}ms`, { hasLocalToken, isAuthCallback });

            const timer = setTimeout(() => {
                setIsGracePeriod(false);
            }, timeoutDuration);
            return () => clearTimeout(timer);
        }
    }, [user, loading]);

    // Separate effect for the actual redirection to ensure we always use the latest state values
    useEffect(() => {
        if (!loading && !isGracePeriod && !user) {
            console.warn(`Dashboard DashboardPage: Session not established after grace period. Redirecting to login...`, {
                loading,
                isGracePeriod,
                hasUser: !!user
            });
            router.replace('/auth/login');
        }
    }, [loading, isGracePeriod, user, router]);

    // Show skeleton shell immediately — never a blank screen
    if (loading || (isGracePeriod && !user)) {
        return <DashboardShellSkeleton />;
    }

    // Shield against rendering without user
    if (!user) return null;

    return (
        <Dashboard
            user={user}
            onLogout={async () => {
                await signOut();
                router.push('/');
            }}
            projects={projects}
            setProjects={setProjects}
            messages={messages}
            setMessages={setMessages}
            galleryItems={galleryItems}
            setGalleryItems={setGalleryItems}
        />
    );
}
