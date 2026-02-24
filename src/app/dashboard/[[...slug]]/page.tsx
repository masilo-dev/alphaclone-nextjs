'use client';

// Force Next.js to not statically cache this page in production
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from 'react';
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
            // Check if we are in an auth callback flow
            const isAuthCallback = typeof window !== 'undefined' && (
                window.location.search.includes('code=') ||
                window.location.pathname.includes('/auth/callback') ||
                sessionStorage.getItem('auth_callback_in_progress') === 'true'
            );

            // A short grace period to wait for any immediate state batching
            // or fast redirects in strict mode, without hanging the browser.
            const timeoutDuration = isAuthCallback ? 2500 : 500;

            console.log(`DashboardPage: User missing, starting short grace period of ${timeoutDuration}ms`);

            const timer = setTimeout(() => {
                setIsGracePeriod(false);
            }, timeoutDuration);
            return () => clearTimeout(timer);
        }
    }, [user, loading]);

    const redirectingRef = useRef(false);

    // Separate effect for the actual redirection to ensure we always use the latest state values
    useEffect(() => {
        if (!loading && !isGracePeriod && !user && !redirectingRef.current) {
            redirectingRef.current = true;
            console.warn(`Dashboard DashboardPage: Session not established after grace period. Redirecting to login...`, {
                loading,
                isGracePeriod,
                hasUser: !!user
            });
            // Force a full page redirect to break any possible React infinite routing loops
            // Using a timestamp to bust Next.js aggressive production router caching
            window.location.replace(`/auth/login?reason=unauthenticated&t=${Date.now()}`);
        }
    }, [loading, isGracePeriod, user]);

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
