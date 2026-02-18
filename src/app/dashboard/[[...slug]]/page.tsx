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
        // Only redirect if NOT already being handled by a shell (to avoid conflicts)
        if (!loading && !user) {
            console.warn('Dashboard DashboardPage: Session not established. Redirecting to login...');
            router.replace('/auth/login');
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
