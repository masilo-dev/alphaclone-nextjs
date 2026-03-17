'use client';

// Force Next.js to not statically cache this page in production
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from 'react';
import Dashboard from '@/components/Dashboard';
import { Project, ChatMessage, GalleryItem } from '@/types';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardShellSkeleton } from '@/components/ui/TabSkeleton';
import { SessionTimeoutWarning, useSessionTimeoutWarning } from '@/components/SessionTimeoutWarning';
import { useTenant } from '@/contexts/TenantContext';
import { SubscriptionGuard } from '@/components/SubscriptionGuard';

export default function DashboardPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
    const { user, loading: authLoading, needsMfa, signOut } = useAuth();
    const { currentTenant, isLoading: tenantLoading } = useTenant();
    const router = useRouter();

    const handleLogout = async () => {
        await signOut();
        router.push('/');
    };

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/auth/login');
        } else if (!authLoading && user && needsMfa) {
            console.log('[Dashboard] User found but MFA required, redirecting to login challenge');
            router.replace('/auth/login?reason=mfa_required');
        }
    }, [user, authLoading, needsMfa, router]);

    // Initialize the session timeout hook (10 min timeout, 2 min warning)
    const { showWarning, countdown, extendSession } = useSessionTimeoutWarning(handleLogout);

    // Show skeleton shell immediately if loading
    if (authLoading || tenantLoading) {
        return <DashboardShellSkeleton />;
    }

    // Shield against rendering without user or if MFA is needed
    if (!user || needsMfa) return <DashboardShellSkeleton />;

    return (
        <SubscriptionGuard>
            <Dashboard
                user={user}
                onLogout={handleLogout}
                projects={projects}
                setProjects={setProjects}
                messages={messages}
                setMessages={setMessages}
                galleryItems={galleryItems}
                setGalleryItems={setGalleryItems}
            />
            <SessionTimeoutWarning
                isOpen={showWarning}
                countdown={countdown}
                onExtendSession={extendSession}
                onLogout={handleLogout}
            />
        </SubscriptionGuard>
    );
}
