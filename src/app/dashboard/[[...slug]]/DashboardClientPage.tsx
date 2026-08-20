'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Project, ChatMessage, GalleryItem, User } from '@/types';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardShellSkeleton } from '@/components/ui/TabSkeleton';
import { SessionTimeoutWarning, useSessionTimeoutWarning } from '@/components/SessionTimeoutWarning';
import { useTenant } from '@/contexts/TenantContext';
import { SubscriptionGuard } from '@/components/SubscriptionGuard';
import { normalizeBusinessRoute } from '@/lib/normalizeDashboardRoute';
import dynamic from 'next/dynamic';

const Dashboard = dynamic(() => import('@/components/Dashboard'), {
    ssr: false,
    loading: () => null,
});

const BusinessDashboard = dynamic(() => import('@/components/dashboard/business/BusinessDashboard'), {
    ssr: false,
    loading: () => null,
});

/** Tenant admins use BusinessDashboard only — skip the heavy Dashboard shell hooks. */
function TenantAdminDashboardShell({
    user,
    onLogout,
}: {
    user: User;
    onLogout: () => void;
}) {
    const location = usePathname();
    const router = useRouter();
    const { currentTenant } = useTenant();
    const businessRoute = useMemo(
        () => normalizeBusinessRoute(location || '/dashboard', user.role),
        [location, user.role],
    );

    return (
        <BusinessDashboard
            user={user}
            currentTenant={currentTenant ?? undefined}
            onLogout={onLogout}
            activeTab={businessRoute}
            setActiveTab={(tab) => router.push(tab)}
        />
    );
}

class BuildErrorLogger extends React.Component<{ children: React.ReactNode }> {
    state = { hasError: false };
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error: any, errorInfo: any) {
        console.error("====================== BUILD ERROR DETECTED ======================");
        console.error("Error Message:", error.message);
        console.error("Stack Trace:", error.stack);
        console.error("Component Stack:", errorInfo.componentStack);
        console.error("==================================================================");
    }
    render() {
        if (this.state.hasError) {
            return <div>Build Error Occurred. See logs above.</div>;
        }
        return this.props.children;
    }
}

export default function DashboardClientPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
    const { user, loading: authLoading, needsMfa, signOut } = useAuth();
    const { isLoading: tenantLoading } = useTenant();
    const router = useRouter();
    const hasBootstrappedRef = useRef(false);

    const isReady = Boolean(user && !needsMfa && !authLoading && !tenantLoading);
    if (isReady) {
        hasBootstrappedRef.current = true;
    }

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

    // Only block with skeleton on the first load — never flash back after the dashboard is interactive.
    if (!hasBootstrappedRef.current && (authLoading || tenantLoading || !user || needsMfa)) {
        return <DashboardShellSkeleton />;
    }

    // Auth redirect in progress — always keep a visible recovery state instead of a blank protected route.
    if (!user || needsMfa) {
        const loginHref = needsMfa ? '/auth/login?reason=mfa_required' : '/auth/login';
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
                <section className="max-w-md rounded-2xl border border-white/10 bg-slate-900/70 p-7 shadow-2xl">
                    <h1 className="text-xl font-semibold">Sign-in required</h1>
                    <p className="mt-2 text-sm text-slate-300">
                        This workspace is protected. Redirecting you to sign in now; if that does not open, use the link below.
                    </p>
                    <Link href={loginHref} className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-teal-400 px-4 text-sm font-semibold text-slate-950 hover:bg-teal-300">
                        Go to sign in
                    </Link>
                </section>
            </main>
        );
    }

    return (
        <BuildErrorLogger>
            <SubscriptionGuard>
                {user.role === 'tenant_admin' || user.role === 'business_dashboard' ? (
                    <TenantAdminDashboardShell user={user} onLogout={handleLogout} />
                ) : (
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
                )}
                <SessionTimeoutWarning
                    isOpen={showWarning}
                    countdown={countdown}
                    onExtendSession={extendSession}
                    onLogout={handleLogout}
                />
            </SubscriptionGuard>
        </BuildErrorLogger>
    );
}
