'use client';

import React, { useState } from 'react';
import Dashboard from '@/components/Dashboard';
import { User, Project, ChatMessage, GalleryItem } from '@/types';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
    // Mock data/state lifting - In a real app, these might come from a layout or context
    // or the Dashboard component handles its own data fetching (which it does partially).

    // NOTE: In the legacy app, these props were passed from App.tsx.
    // We need to either replicate that state here or move state inside Dashboard.
    // Given Dashboard.tsx has "setProjects", "setMessages", etc., it expects to control them.
    // We will initialize them here.

    const [projects, setProjects] = useState<Project[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
    const router = useRouter();

    // Mock User - In real app, strictly use Auth Context
    // logic inside Dashboard uses "user" prop.
    // We should prob get user from useAuth/useUser hook if available, or pass dummy for now until Auth is fully migrated.
    // BUT the previous step verified LandingPage login... wait, LandingPage had "onLogin".
    // Where is the global user state? 
    // In the legacy App.tsx, "user" state was at the top level.
    // We need a way to share user state.
    // We updated LandingPage (page.tsx) to have local user state.
    // We need a Global Context or similar.
    // Wait, `TenantContext` exists. Does it have User?
    // `src/contexts/TenantContext.tsx` seems to manage tenants but maybe user too?
    // Let's check `src/lib/auth.ts` or similar...
    // Oh, `authService.getCurrentUser()` is available.

    // Quick fix: Use a local state here that tries to fetch user on mount, 
    // preventing access if not logged in.

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        // Check auth
        const checkAuth = async () => {
            try {
                // 1. Check for Ghost User logic first (Manual override)
                const ghostUserStr = localStorage.getItem('alphaclone_ghost_user');
                if (ghostUserStr) {
                    try {
                        const ghostUser = JSON.parse(ghostUserStr);
                        setUser(ghostUser);
                        setLoading(false);
                        return;
                    } catch (e) {
                        localStorage.removeItem('alphaclone_ghost_user');
                    }
                }

                // 2. Real Auth check
                const { authService } = await import('@/services/authService');

                // Add a timeout fallback for auth check to prevent permanent "Loading OS"
                const authPromise = authService.getCurrentUser();
                const timeoutPromise = new Promise<{ user: any, error: any }>((resolve) =>
                    setTimeout(() => resolve({ user: null, error: 'Auth timeout' }), 8000)
                );

                const { user: currentUser, error } = await Promise.race([authPromise, timeoutPromise]);

                if (currentUser) {
                    setUser(currentUser);
                } else {
                    console.warn('Dashboard Auth Check: No user or timeout. Redirecting to landing.', error);
                    router.push('/');
                }
            } catch (err) {
                console.error('Dashboard Auth Check Error:', err);
                router.push('/');
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, [router]);

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">Loading OS...</div>;
    if (!user) return null; // or redirecting

    return (
        <Dashboard
            user={user}
            onLogout={() => {
                import('@/services/authService').then(({ authService }) => authService.signOut());
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
