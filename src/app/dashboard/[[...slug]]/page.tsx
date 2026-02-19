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

    useEffect(() => {
        // Redirection logic: If loading is done and no user exists, send to login
        if (!loading && !user) {
            // Check if there is even a HINT of a session in localStorage
            // Supabase keys start with 'sb-'
            // Also check for any key that might look like a token to be safe
            const hasLocalToken = typeof window !== 'undefined' &&
                Object.keys(localStorage).some(k => k.startsWith('sb-'));

            // Increased timeout to account for slower connections/device processing
            const timeoutDuration = hasLocalToken ? 3000 : 2500;

            const timer = setTimeout(() => {
                // Double check user still null after grace period
                if (!user) {
                    console.warn(`Dashboard DashboardPage: Session not established after ${timeoutDuration}ms. Redirecting to login...`);
                    router.replace('/auth/login');
                }
            }, timeoutDuration);
            return () => clearTimeout(timer);
        }
    }, [user, loading, router]);

    // Show skeleton shell immediately — never a blank screen
    if (loading) {
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
