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

    // Premium Loading State for "Loading OS" experience
    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans overflow-hidden">
                <div className="relative group">
                    {/* Animated Outer Ring */}
                    <div className="w-32 h-32 border-2 border-teal-500/20 rounded-full"></div>
                    <div className="absolute inset-0 w-32 h-32 border-t-2 border-teal-500 rounded-full animate-spin"></div>

                    {/* Pulsing Core */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 bg-teal-500/10 rounded-full blur-2xl animate-pulse"></div>
                    </div>

                    {/* Central Icon placeholder or Logo */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-teal-400 rounded-full shadow-[0_0_15px_rgba(45,212,191,0.8)]"></div>
                    </div>
                </div>

                <div className="mt-12 space-y-4 text-center">
                    <h2 className="text-3xl font-black tracking-[0.3em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-blue-500 to-violet-600 animate-gradient-x">
                        Alpha OS
                    </h2>
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-slate-500 text-xs font-bold tracking-[0.2em] uppercase">
                            Establishing Neural Link
                        </p>
                        <div className="w-48 h-1 bg-slate-900 rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-teal-500 w-1/3 animate-loading-bar"></div>
                        </div>
                    </div>
                </div>

                <style jsx>{`
                    @keyframes loading-bar {
                        0% { transform: translateX(-100%); }
                        50% { transform: translateX(50%); }
                        100% { transform: translateX(100%); }
                    }
                    .animate-loading-bar {
                        animation: loading-bar 2s infinite ease-in-out;
                    }
                    .animate-gradient-x {
                        background-size: 200% auto;
                        animation: gradient-x 3s linear infinite;
                    }
                    @keyframes gradient-x {
                        0% { background-position: 0% 50%; }
                        50% { background-position: 100% 50%; }
                        100% { background-position: 0% 50%; }
                    }
                `}</style>
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
