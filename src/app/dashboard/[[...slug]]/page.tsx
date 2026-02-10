'use client';

import React, { useState, useEffect } from 'react';
import Dashboard from '@/components/Dashboard';
import { Project, ChatMessage, GalleryItem } from '@/types';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
    const { user, loading, signOut } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
    const router = useRouter();

    useEffect(() => {
        // Redirection logic: If loading is done and no user exists, send to home
        if (!loading && !user) {
            console.warn('Dashboard DashboardPage: Session not established. Redirecting...');
            router.push('/');
        }
    }, [user, loading, router]);

    // Fast minimal loading - no delays
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
                    <span className="text-slate-400 text-sm">Loading...</span>
                </div>
            </div>
        );
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
