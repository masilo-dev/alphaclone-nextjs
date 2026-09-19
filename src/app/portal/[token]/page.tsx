'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowUpRight,
    CheckCircle2,
    ChevronRight,
    Clock,
    FileText,
    FolderKanban,
    Home,
    Landmark,
    Loader2,
    Menu,
    MessageSquare,
    Receipt,
    ScrollText,
    Send,
    ShieldCheck,
    Signature,
    X,
    FileCheck,
    Bell,
    CalendarClock,
    CreditCard,
    Activity,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ClientFinancePortalData } from '@/services/finance/clientFinancePortalService';

type Tab = 'overview' | 'projects' | 'invoices' | 'quotes' | 'contracts' | 'documents' | 'messages';
type PortalMessage = { id: string; project_id: string; projectName: string; author_name: string; content: string; is_client: boolean; created_at: string };

const money = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

const statusBadgeClass = (status: string): string => {
    const s = status.toLowerCase();
    if (['paid', 'approved', 'signed', 'completed', 'done', 'active'].some((k) => s.includes(k)))
        return 'bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[color:var(--success)] border-[color-mix(in_srgb,var(--success)_28%,transparent)]';
    if (['overdue', 'failed', 'rejected', 'canceled', 'cancelled'].some((k) => s.includes(k)))
        return 'bg-[color-mix(in_srgb,var(--error)_14%,transparent)] text-[color:var(--error)] border-[color-mix(in_srgb,var(--error)_28%,transparent)]';
    if (['sent', 'viewed', 'pending', 'partially_paid', 'in_progress', 'review'].some((k) => s.includes(k)))
        return 'bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[color:var(--warning)] border-[color-mix(in_srgb,var(--warning)_28%,transparent)]';
    if (['draft'].some((k) => s.includes(k)))
        return 'bg-[color-mix(in_srgb,var(--text-muted)_14%,transparent)] text-[color:var(--text-muted)] border-[color-mix(in_srgb,var(--text-muted)_28%,transparent)]';
    return 'bg-[color-mix(in_srgb,var(--info)_14%,transparent)] text-[color:var(--info)] border-[color-mix(in_srgb,var(--info)_28%,transparent)]';
};

const NAV: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
    { id: 'quotes', label: 'Quotes', icon: FileText },
    { id: 'contracts', label: 'Contracts', icon: ScrollText },
    { id: 'documents', label: 'Documents', icon: FileCheck },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
];

function Shell({
    portal, activeTab, setActiveTab, children,
}: {
    portal: ClientFinancePortalData;
    activeTab: Tab;
    setActiveTab: (t: Tab) => void;
    children: React.ReactNode;
}) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const visibleNav = NAV.filter((n) => {
        if (n.id === 'quotes') return (portal.quotes?.length ?? 0) > 0;
        return true;
    });
    const counts = useMemo(() => ({
        invoices: portal.summary.openInvoices,
        approvals: portal.approvals.length,
        messages: 0,
    }), [portal]);

    return (
        <div className="min-h-screen w-full bg-[color:var(--background-app)] text-[color:var(--text-primary)]">
            <div className="flex min-h-screen w-full">
                {/* DESKTOP SIDEBAR */}
                <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col border-r border-[color:var(--border-default)] bg-[color:var(--ws-sidebar)] text-[color:var(--ws-text-primary)]">
                    <div className="flex h-16 items-center gap-3 px-5 border-b border-white/[0.06]">
                        {portal.branding.logoUrl ? (
                            <img
                                src={portal.branding.logoUrl}
                                alt=""
                                className="h-10 w-10 rounded-xl object-contain bg-[color:var(--ws-panel)] border border-[color:var(--ws-border)]"
                            />
                        ) : (
                            <div className="grid h-10 w-10 place-items-center rounded-xl border border-[color:var(--ws-border)] bg-[color-mix(in_srgb,var(--brand-teal)_18%,var(--ws-panel))] text-[color:var(--brand-teal)] font-black">
                                {String(portal.branding.name || 'A').charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold leading-tight">{portal.branding.name}</p>
                            <p className="truncate text-xs text-[color:var(--ws-text-tertiary)]">Client workspace</p>
                        </div>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Client workspace">
                        <ul className="space-y-0.5">
                            {visibleNav.map((item) => {
                                const Icon = item.icon;
                                const isActive = activeTab === item.id;
                                const badge =
                                    item.id === 'invoices' ? counts.invoices :
                                    item.id === 'overview' ? counts.approvals : undefined;
                                return (
                                    <li key={item.id}>
                                        <button
                                            onClick={() => setActiveTab(item.id)}
                                            className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                                                isActive
                                                    ? 'bg-[color-mix(in_srgb,var(--brand-teal)_18%,var(--ws-panel))] text-[color:var(--brand-teal)] font-medium'
                                                    : 'text-[color:var(--ws-text-secondary)] hover:bg-[color:var(--ws-panel-hover)] hover:text-[color:var(--ws-text-primary)]'
                                            }`}
                                        >
                                            <Icon className="h-4.5 w-4.5 shrink-0" />
                                            <span className="flex-1 text-left">{item.label}</span>
                                            {typeof badge === 'number' && badge > 0 ? (
                                                <span className={`inline-flex min-w-[20px] h-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                                                    isActive
                                                        ? 'bg-[color-mix(in_srgb,var(--brand-teal)_28%,transparent)] text-[color:var(--brand-teal)]'
                                                        : 'bg-[color-mix(in_srgb,var(--warning)_20%,transparent)] text-[color:var(--warning)]'
                                                }`}>{badge}</span>
                                            ) : null}
                                            {isActive ? <ChevronRight className="h-4 w-4 opacity-70" /> : null}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    <div className="border-t border-white/[0.06] p-4">
                        <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 place-items-center rounded-full bg-[color-mix(in_srgb,var(--brand-blue-500)_20%,var(--ws-panel))] text-[color:var(--brand-blue-400)] text-sm font-semibold">
                                {String(portal.client.name || 'C').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{portal.client.name}</p>
                                <p className="truncate text-xs text-[color:var(--ws-text-tertiary)]">{portal.client.email || 'Client account'}</p>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-[color:var(--ws-panel)] px-3 py-2 text-[11px] text-[color:var(--ws-text-tertiary)] border border-[color:var(--ws-border)]">
                            <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--success)]" />
                            <span>Private · secure connection</span>
                        </div>
                    </div>
                </aside>

                {/* MAIN AREA */}
                <div className="flex min-w-0 flex-1 flex-col">
                    {/* DESKTOP + MOBILE TOP BAR */}
                    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[color:var(--border-default)] bg-[color:var(--ws-toolbar)] px-4 md:px-6 lg:px-8">
                        <button
                            type="button"
                            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] text-[color:var(--ws-text-primary)]"
                            aria-label="Open navigation"
                            onClick={() => setMobileMenuOpen(true)}
                        >
                            <Menu className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
                        </button>

                        <div className="min-w-0 flex-1 md:hidden">
                            <div className="flex items-center gap-2">
                                {portal.branding.logoUrl ? (
                                    <img src={portal.branding.logoUrl} alt="" className="h-7 w-7 rounded-lg object-contain" />
                                ) : (
                                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--brand-teal)_22%,var(--ws-panel))] text-[color:var(--brand-teal)] text-xs font-black">
                                        {String(portal.branding.name || 'A').charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold leading-tight">{portal.branding.name}</p>
                                    <p className="truncate text-[11px] text-[color:var(--ws-text-tertiary)]">Client workspace</p>
                                </div>
                            </div>
                        </div>

                        <div className="hidden md:flex min-w-0 flex-col">
                            <p className="text-[15px] font-semibold leading-tight text-[color:var(--ws-text-primary)]">
                                {NAV.find((n) => n.id === activeTab)?.label ?? 'Overview'}
                            </p>
                            <p className="text-xs text-[color:var(--ws-text-tertiary)]">
                                Welcome back, {portal.client.name.split(' ')[0]}
                            </p>
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            <div className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-[color:var(--ws-text-tertiary)] bg-[color:var(--ws-panel)] border border-[color:var(--ws-border)]">
                                <Bell className="h-3.5 w-3.5 text-[color:var(--warning)]" />
                                {counts.approvals + counts.invoices} items need your attention
                            </div>
                            <div className="hidden sm:grid h-8 w-8 place-items-center rounded-full bg-[color-mix(in_srgb,var(--brand-blue-500)_20%,var(--ws-panel))] text-[color:var(--brand-blue-400)] text-xs font-semibold border border-[color:var(--ws-border)]">
                                {String(portal.client.name || 'C').charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </header>

                    {/* SCROLLING CONTENT */}
                    <main className="flex-1 overflow-y-auto">
                        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-10">
                            {children}
                        </div>

                        <footer className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 lg:px-8 border-t border-transparent">
                            <p className="text-center text-xs text-[color:var(--text-muted)]">
                                <span className="inline-flex items-center gap-1.5">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    Secured by AlphaClone · private client workspace
                                </span>
                            </p>
                        </footer>
                    </main>

                    {/* MOBILE BOTTOM NAV */}
                    <nav className="md:hidden sticky bottom-0 z-30 border-t border-[color:var(--border-default)] bg-[color:var(--ws-toolbar)]" aria-label="Mobile navigation">
                        <ul className="grid grid-flow-col auto-cols-fr gap-0.5 px-1 py-1.5 pb-[max(6px,env(safe-area-inset-bottom))]">
                            {visibleNav.slice(0, 5).map((item) => {
                                const Icon = item.icon;
                                const isActive = activeTab === item.id;
                                return (
                                    <li key={item.id}>
                                        <button
                                            onClick={() => setActiveTab(item.id)}
                                            className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 px-1 ${
                                                isActive
                                                    ? 'text-[color:var(--brand-teal)] bg-[color-mix(in_srgb,var(--brand-teal)_14%,transparent)]'
                                                    : 'text-[color:var(--ws-text-tertiary)]'
                                            }`}
                                        >
                                            <Icon className="h-5 w-5" />
                                            <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                </div>
            </div>

            {/* MOBILE DRAWER */}
            {mobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
                    <div className="absolute left-0 top-0 bottom-0 w-[82%] max-w-xs bg-[color:var(--ws-sidebar)] text-[color:var(--ws-text-primary)] shadow-2xl border-r border-[color:var(--ws-border)] overflow-y-auto">
                        <div className="flex h-14 items-center gap-3 px-4 border-b border-white/[0.06]">
                            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--brand-teal)_22%,var(--ws-panel))] text-[color:var(--brand-teal)] text-sm font-black">
                                {String(portal.branding.name || 'A').charAt(0).toUpperCase()}
                            </div>
                            <p className="truncate text-sm font-semibold flex-1">{portal.branding.name}</p>
                            <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <ul className="p-2 space-y-0.5">
                            {visibleNav.map((item) => {
                                const Icon = item.icon;
                                const isActive = activeTab === item.id;
                                return (
                                    <li key={item.id}>
                                        <button
                                            onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                                                isActive
                                                    ? 'bg-[color-mix(in_srgb,var(--brand-teal)_18%,var(--ws-panel))] text-[color:var(--brand-teal)] font-medium'
                                                    : 'text-[color:var(--ws-text-secondary)]'
                                            }`}
                                        >
                                            <Icon className="h-4.5 w-4.5" />
                                            <span>{item.label}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                        <div className="p-4 mt-2 border-t border-white/[0.06]">
                            <p className="text-xs text-[color:var(--ws-text-tertiary)]">Signed in as</p>
                            <p className="text-sm font-medium mt-0.5">{portal.client.name}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, hint, accent, icon: Icon }: { label: string; value: string | number; hint?: string; accent?: string; icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }) {
    return (
        <div className="rounded-xl border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] p-4 md:p-5 shadow-[color:var(--ws-card-shadow)]">
            <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--ws-border)] bg-[color:var(--ws-surface-secondary)]">
                    {Icon ? <Icon className="h-4.5 w-4.5 text-[color:var(--ws-text-tertiary)]" style={{ color: accent }} /> : null}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--ws-text-tertiary)]">{label}</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight" style={{ color: accent }}>{value}</p>
                    {hint ? <p className="mt-1 text-xs text-[color:var(--ws-text-tertiary)]">{hint}</p> : null}
                </div>
            </div>
        </div>
    );
}

function EmptyState({ title, description, icon: Icon }: { title: string; description: string; icon?: React.ComponentType<{ className?: string }> }) {
    return (
        <div className="rounded-xl border border-dashed border-[color:var(--ws-border)] bg-[color:var(--ws-surface-secondary)] p-8 md:p-12 text-center">
            {Icon ? (
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] text-[color:var(--ws-text-tertiary)]">
                    <Icon className="h-6 w-6" />
                </div>
            ) : null}
            <h3 className="text-base font-semibold text-[color:var(--ws-text-primary)]">{title}</h3>
            <p className="mt-1.5 text-sm text-[color:var(--ws-text-tertiary)] max-w-md mx-auto">{description}</p>
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="min-h-screen w-full bg-[color:var(--background-app)] animate-pulse">
            <div className="flex min-h-screen w-full">
                <div className="hidden md:block md:w-64 lg:w-72 shrink-0 border-r border-[color:var(--border-default)] bg-[color:var(--ws-sidebar)]" />
                <div className="min-w-0 flex-1 flex-col">
                    <div className="h-14 border-b border-[color:var(--border-default)] bg-[color:var(--ws-toolbar)]" />
                    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8 lg:px-8 space-y-6">
                        <div className="h-8 w-48 rounded-md bg-[color:var(--ws-panel)]" />
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {[0,1,2].map((i) => <div key={i} className="h-28 rounded-xl bg-[color:var(--ws-panel)] border border-[color:var(--ws-border)]" />)}
                        </div>
                        <div className="h-40 rounded-xl bg-[color:var(--ws-panel)] border border-[color:var(--ws-border)]" />
                        <div className="h-64 rounded-xl bg-[color:var(--ws-panel)] border border-[color:var(--ws-border)]" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function ErrorState({ message }: { message: string }) {
    return (
        <div className="min-h-screen w-full bg-[color:var(--background-app)] grid place-items-center p-6">
            <div className="w-full max-w-md rounded-2xl border border-[color:var(--error-border)] bg-[color:var(--error-surface)] p-6 md:p-8 text-center">
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[color-mix(in_srgb,var(--error)_14%,transparent)] text-[color:var(--error)]">
                    <AlertTriangle className="h-6 w-6" />
                </div>
                <h1 className="text-lg font-bold text-[color:var(--ws-text-primary)]">Workspace unavailable</h1>
                <p className="mt-2 text-sm text-[color:var(--ws-text-secondary)]">{message}</p>
                <p className="mt-4 text-xs text-[color:var(--ws-text-tertiary)]">
                    If you received this link from {''}
                    <span className="font-medium">your service provider</span>, please verify the URL or contact them for a new access link.
                </p>
            </div>
        </div>
    );
}

type RowAny = { id: string; [k: string]: any };

function DataCardList<T extends RowAny>({
    rows, empty, icon: Icon, render,
}: {
    rows: T[];
    empty: { title: string; description: string };
    icon: React.ComponentType<{ className?: string }>;
    render: (row: T) => React.ReactNode;
}) {
    if (!rows.length) return <EmptyState title={empty.title} description={empty.description} icon={Icon} />;
    return (
        <div className="space-y-3">
            {rows.map((row) => (
                <div key={row.id} className="rounded-xl border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] p-4 md:p-5 shadow-[color:var(--ws-card-shadow)] hover:border-[color:var(--ws-border-strong)] transition-colors">
                    {render(row)}
                </div>
            ))}
        </div>
    );
}

export default function ClientPortalPage() {
    const router = useRouter();
    const token = useParams()?.token as string;

    const handle401 = useCallback(() => {
        if (!token) {
            router.replace('/portal-login');
            return;
        }
        const nextPath = `/portal/${encodeURIComponent(token)}`;
        router.replace(`/portal-login?next=${encodeURIComponent(nextPath)}`);
    }, [router, token]);

    const [portal, setPortal] = useState<ClientFinancePortalData | null>(null);
    const [messages, setMessages] = useState<PortalMessage[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [message, setMessage] = useState('');
    const [projectId, setProjectId] = useState('');
    const [sending, setSending] = useState(false);
    const [documentPreview, setDocumentPreview] = useState<{ name: string; url: string } | null>(null);
    const [deciding, setDeciding] = useState<string | null>(null);
    const [workspaceActivity, setWorkspaceActivity] = useState<Array<{ id: string; event_type: string; summary: string; actor_display_name: string | null; created_at: string; metadata: Record<string, unknown> }>>([]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4200);
        return () => clearTimeout(t);
    }, [toast]);

    const loadMessages = useCallback(async () => {
        if (!token) return;
        try {
            const r = await fetch(`/api/client-finance/messages?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
            if (r.status === 401) {
                handle401();
                return;
            }
            const d = await r.json().catch(() => ({}));
            if (r.ok) setMessages(d.messages || []);
        } catch {
            /* swallow network flakes; next poll or reload will recover */
        }
    }, [token, handle401]);

    const loadWorkspaceActivity = useCallback(async () => {
        if (!token) return;
        try {
            const r = await fetch(`/api/client-finance/activity?token=${encodeURIComponent(token)}&limit=10`, { cache: 'no-store' });
            if (r.status === 401) {
                handle401();
                return;
            }
            const d = await r.json().catch(() => ({}));
            if (r.ok) setWorkspaceActivity(d.activity || []);
        } catch {
            /* swallow network flakes; next poll or reload will recover */
        }
    }, [token, handle401]);

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        (async () => {
            try {
                const r = await fetch(`/api/client-finance/portal?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
                if (r.status === 401) {
                    if (!cancelled) handle401();
                    return;
                }
                const d = await r.json().catch(() => ({}));
                if (cancelled) return;
                if (!r.ok || !d.portal) throw new Error(d.error || 'This workspace link is no longer available.');
                setPortal(d.portal);
                setProjectId(d.portal.projects?.[0]?.id || '');
                await loadMessages();
                await loadWorkspaceActivity();
            } catch (cause) {
                if (cancelled) return;
                setError(cause instanceof Error ? cause.message : 'Failed to load workspace');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [token, loadMessages, loadWorkspaceActivity, handle401]);

    const projectIds = useMemo(() => new Set(portal?.projects.map((p) => p.id) || []), [portal]);
    useEffect(() => {
        if (!portal || !projectIds.size || !token) return;
        const channel = supabase
            .channel(`client_portal_messages_${token}`)
            .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'project_comments' }, (event: any) => {
                if (projectIds.has(event.new.project_id)) loadMessages();
            })
            .subscribe();
        return () => { void channel.unsubscribe(); };
    }, [portal, projectIds, token, loadMessages]);

    async function sendMessage(event: React.FormEvent) {
        event.preventDefault();
        if (!message.trim() || !projectId) return;
        setSending(true);
        try {
            const r = await fetch('/api/client-finance/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, projectId, content: message }),
            });
            if (r.status === 401) {
                handle401();
                return;
            }
            if (!r.ok) throw new Error('Message could not be sent');
            setMessage('');
            setToast({ type: 'success', text: 'Message sent' });
            await loadMessages();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Message could not be sent');
            setToast({ type: 'error', text: 'Message could not be sent' });
        } finally {
            setSending(false);
        }
    }

    async function decideApproval(approvalId: string, decision: 'approved' | 'changes_requested') {
        setDeciding(approvalId);
        try {
            const r = await fetch('/api/client-finance/approvals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, approvalId, decision }),
            });
            if (r.status === 401) {
                handle401();
                return;
            }
            if (!r.ok) throw new Error('Decision could not be saved');
            setToast({ type: 'success', text: decision === 'approved' ? 'Approval recorded' : 'Change request sent' });
            window.location.reload();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Decision could not be saved');
            setToast({ type: 'error', text: 'Decision could not be saved' });
        } finally {
            setDeciding(null);
        }
    }

    if (loading) return <LoadingSkeleton />;
    if (error && !portal) return <ErrorState message={error} />;
    if (!portal) return null;

    return (
        <Shell portal={portal} activeTab={activeTab} setActiveTab={setActiveTab}>
            <div className="space-y-6 md:space-y-8">
                {/* Toast */}
                {toast ? (
                    <div className={`sticky top-16 z-20 mx-auto flex max-w-sm items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${
                        toast.type === 'success'
                            ? 'border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_92%,var(--ws-panel))] text-[color:var(--success-text,var(--success))]'
                            : 'border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_92%,var(--ws-panel))] text-[color:var(--error)]'
                    }`}
                        style={{
                            backgroundColor: toast.type === 'success'
                                ? 'color-mix(in srgb, var(--success) 10%, var(--ws-panel))'
                                : 'color-mix(in srgb, var(--error) 10%, var(--ws-panel))',
                        }}
                    >
                        {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                        <span>{toast.text}</span>
                    </div>
                ) : null}

                {/* Error banner (non-fatal — when there's also data) */}
                {error && portal ? (
                    <div role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,var(--ws-panel))] p-4 text-sm">
                        <div className="flex gap-3">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[color:var(--warning)]" />
                            <p className="text-[color:var(--ws-text-primary)]">{error}</p>
                        </div>
                    </div>
                ) : null}

                {/* PAGE HEADER for overview tab */}
                {activeTab === 'overview' && (
                    <div className="rounded-2xl border border-[color:var(--ws-border)] bg-gradient-to-br from-[color:var(--ws-panel)] to-[color:var(--ws-surface-secondary)] p-5 md:p-7 lg:p-8 shadow-[color:var(--ws-card-shadow)]">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 max-w-2xl">
                                <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-teal)]">Good to see you</p>
                                <h1 className="mt-1.5 text-2xl md:text-3xl font-bold tracking-tight text-[color:var(--ws-text-primary)]">
                                    Hi, {portal.client.name.split(' ')[0]}{''}
                                    <span className="text-[color:var(--ws-text-tertiary)]">.</span>
                                </h1>
                                <p className="mt-2.5 text-sm md:text-[15px] leading-relaxed text-[color:var(--ws-text-secondary)]">
                                    Here's your shared workspace with <span className="font-medium text-[color:var(--ws-text-primary)]">{portal.branding.name}</span>.
                                    Review outstanding items, track project progress, view invoices, and message the team — all in one secure place.
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3 rounded-xl border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] p-3 lg:p-4">
                                <div className="grid h-11 w-11 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--success)_14%,var(--ws-panel))] text-[color:var(--success)]">
                                    <ShieldCheck className="h-5.5 w-5.5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-[color:var(--ws-text-primary)]">Verified access</p>
                                    <p className="text-xs text-[color:var(--ws-text-tertiary)]">Secure · encrypted · private</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* SECTION HEADER for non-overview tabs */}
                {activeTab !== 'overview' && (() => {
                    const meta = NAV.find((n) => n.id === activeTab)!;
                    const Icon = meta.icon;
                    return (
                        <div className="flex items-end justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] text-[color:var(--ws-text-tertiary)]">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[color:var(--ws-text-primary)]">{meta.label}</h1>
                                    <p className="text-sm text-[color:var(--ws-text-tertiary)]">
                                        Shared with <span className="font-medium">{portal.branding.name}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* OVERVIEW */}
                {activeTab === 'overview' && (
                    <div className="space-y-6 md:space-y-8">
                        <section aria-labelledby="portal-guide-heading" className="rounded-2xl border border-[color-mix(in_srgb,var(--brand-teal)_28%,var(--ws-border))] bg-[color-mix(in_srgb,var(--brand-teal)_6%,var(--ws-panel))] p-5 md:p-6">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="max-w-2xl">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--brand-teal)]">Your shared workspace</p>
                                    <h2 id="portal-guide-heading" className="mt-1 text-lg font-semibold text-[color:var(--ws-text-primary)]">Here is what you can do next</h2>
                                    <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--ws-text-secondary)]">Use this workspace to review what your provider shares, respond to requests, and keep project, billing, and communication in one place.</p>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[34rem]">
                                    {[
                                        { tab: 'projects' as Tab, step: '1', title: 'Track work', text: 'See progress and deliverables' },
                                        { tab: 'invoices' as Tab, step: '2', title: 'Handle billing', text: 'Review invoices and payments' },
                                        { tab: 'messages' as Tab, step: '3', title: 'Stay aligned', text: 'Message your project team' },
                                    ].map((item) => (
                                        <button key={item.tab} type="button" onClick={() => setActiveTab(item.tab)} className="rounded-xl border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] p-3 text-left transition-colors hover:border-[color:var(--brand-teal)]/50 hover:bg-[color:var(--ws-panel-hover)]">
                                            <span className="text-[10px] font-bold text-[color:var(--brand-teal)]">STEP {item.step}</span>
                                            <span className="mt-1 block text-xs font-semibold text-[color:var(--ws-text-primary)]">{item.title}</span>
                                            <span className="mt-0.5 block text-[11px] leading-relaxed text-[color:var(--ws-text-tertiary)]">{item.text}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard
                                label="Active projects"
                                value={portal.projects.length}
                                icon={FolderKanban}
                                accent="var(--info)"
                            />
                            <StatCard
                                label="Open invoices"
                                value={portal.summary.openInvoices}
                                hint={portal.summary.openBalance > 0 ? `Balance due: ${money(portal.summary.openBalance)}` : 'No balance due'}
                                icon={CreditCard}
                                accent="var(--warning)"
                            />
                            <StatCard
                                label="Pending quotes"
                                value={portal.summary.pendingQuotes}
                                icon={FileText}
                                accent="var(--brand-blue-400)"
                            />
                            <StatCard
                                label="Needs your review"
                                value={portal.approvals.length}
                                hint={portal.approvals.length > 0 ? 'Action required' : 'Nothing pending'}
                                icon={Clock}
                                accent="var(--brand-teal)"
                            />
                        </div>

                        {/* ATTENTION BLOCK */}
                        <section aria-labelledby="attention-heading" className="rounded-2xl border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] shadow-[color:var(--ws-card-shadow)]">
                            <header className="flex items-center justify-between gap-3 px-5 py-4 md:px-6 md:py-5 border-b border-[color:var(--ws-border)]">
                                <div className="flex items-center gap-2.5">
                                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--warning)_16%,var(--ws-panel))] text-[color:var(--warning)]">
                                        <CalendarClock className="h-4 w-4" />
                                    </div>
                                    <h2 id="attention-heading" className="text-base md:text-lg font-semibold text-[color:var(--ws-text-primary)]">
                                        Needs your attention
                                    </h2>
                                </div>
                                <span className="text-xs text-[color:var(--ws-text-tertiary)]">
                                    {portal.approvals.length} item{portal.approvals.length === 1 ? '' : 's'}
                                </span>
                            </header>
                            <div className="p-4 md:p-5">
                                {portal.approvals.length > 0 ? (
                                    <ul className="divide-y divide-[color:var(--ws-border)] border border-[color:var(--ws-border)] rounded-xl overflow-hidden">
                                        {portal.approvals.map((a) => (
                                            <li key={a.id} className="p-4 md:p-5 bg-[color:var(--ws-surface-secondary)]">
                                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="font-semibold text-[color:var(--ws-text-primary)]">{a.title}</p>
                                                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(a.status)}`}>
                                                                <Clock className="h-3 w-3" />
                                                                {a.approvalType}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 text-xs text-[color:var(--ws-text-tertiary)]">
                                                            <span className="font-medium text-[color:var(--ws-text-secondary)]">{a.projectName}</span>
                                                            {' · '}approval request
                                                        </p>
                                                        {a.description ? (
                                                            <p className="mt-2 text-sm text-[color:var(--ws-text-secondary)] leading-relaxed">{a.description}</p>
                                                        ) : null}
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-2">
                                                        <button
                                                            onClick={() => decideApproval(a.id, 'changes_requested')}
                                                            disabled={deciding === a.id}
                                                            className="inline-flex items-center justify-center rounded-lg border border-[color:var(--ws-border-strong)] bg-[color:var(--ws-panel)] hover:bg-[color:var(--ws-panel-hover)] px-3.5 py-2 text-xs md:text-sm font-semibold text-[color:var(--ws-text-primary)] disabled:opacity-50"
                                                        >
                                                            {deciding === a.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                                                            Request changes
                                                        </button>
                                                        <button
                                                            onClick={() => decideApproval(a.id, 'approved')}
                                                            disabled={deciding === a.id}
                                                            className="inline-flex items-center justify-center rounded-lg bg-[color:var(--brand-teal)] hover:opacity-90 px-3.5 py-2 text-xs md:text-sm font-semibold text-white disabled:opacity-50"
                                                        >
                                                            {deciding === a.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                                                            Approve
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <EmptyState
                                        icon={CheckCircle2}
                                        title="You're all caught up"
                                        description="When there are payments, signatures, or approvals waiting, we'll list them clearly here with one-click actions."
                                    />
                                )}
                            </div>
                        </section>

                        {/* 2-column grid */}
                        <div className="grid gap-6 lg:grid-cols-2">
                            {/* Recent activity */}
                            <section aria-labelledby="activity-heading" className="rounded-2xl border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] shadow-[color:var(--ws-card-shadow)]">
                                <header className="flex items-center justify-between gap-3 px-5 py-4 md:px-6 md:py-5 border-b border-[color:var(--ws-border)]">
                                    <h2 id="activity-heading" className="text-base md:text-lg font-semibold text-[color:var(--ws-text-primary)]">Recent activity</h2>
                                    <span className="text-xs text-[color:var(--ws-text-tertiary)]">Last 30 days</span>
                                </header>
                                <div className="p-4 md:p-5 max-h-[420px] overflow-y-auto">
                                    {portal.activity.length > 0 ? (
                                        <ol className="relative border-l border-[color:var(--ws-border)] ml-2.5">
                                            {portal.activity.slice(0, 10).map((event, i) => (
                                                <li key={event.id} className="ml-5 pb-5 last:pb-0">
                                                    <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-[color:var(--brand-teal)] ring-4 ring-[color:var(--ws-panel)]" />
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                        <p className="text-sm font-medium capitalize text-[color:var(--ws-text-primary)]">{event.title}</p>
                                                    </div>
                                                    {event.projectName ? (
                                                        <p className="text-xs text-[color:var(--ws-text-tertiary)] mt-0.5">{event.projectName}</p>
                                                    ) : null}
                                                    <time className="mt-1 inline-block text-[11px] text-[color:var(--ws-text-tertiary)]">{formatDate(event.createdAt)}</time>
                                                </li>
                                            ))}
                                        </ol>
                                    ) : (
                                        <EmptyState
                                            icon={Clock}
                                            title="No activity yet"
                                            description="Your project, payment, document, and approval activity will appear here as things happen."
                                        />
                                    )}
                                </div>
                            </section>

                            {/* Quick links */}
                            <section aria-labelledby="quick-heading" className="rounded-2xl border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] shadow-[color:var(--ws-card-shadow)]">
                                <header className="flex items-center justify-between gap-3 px-5 py-4 md:px-6 md:py-5 border-b border-[color:var(--ws-border)]">
                                    <h2 id="quick-heading" className="text-base md:text-lg font-semibold text-[color:var(--ws-text-primary)]">Jump to</h2>
                                </header>
                                <div className="p-4 md:p-5 grid sm:grid-cols-2 gap-3">
                                    {[
                                        { id: 'projects' as Tab, label: 'Projects', hint: `${portal.projects.length} shared`, icon: FolderKanban, accent: 'var(--info)' },
                                        { id: 'invoices' as Tab, label: 'Invoices', hint: `${portal.summary.openInvoices} open`, icon: Receipt, accent: 'var(--warning)' },
                                        { id: 'contracts' as Tab, label: 'Contracts', hint: `${portal.contracts.length} total`, icon: Signature, accent: 'var(--brand-blue-400)' },
                                        { id: 'messages' as Tab, label: 'Messages', hint: 'Message the team', icon: MessageSquare, accent: 'var(--brand-teal)' },
                                    ].filter((t) => t.id !== 'quotes' || (portal.quotes?.length ?? 0) > 0)
                                    .map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => setActiveTab(item.id)}
                                                className="group flex items-start gap-3 rounded-xl border border-[color:var(--ws-border)] bg-[color:var(--ws-surface-secondary)] hover:border-[color:var(--ws-border-strong)] hover:bg-[color:var(--ws-panel-hover)] p-4 text-left transition-all"
                                            >
                                                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)]" style={{ color: item.accent }}>
                                                    <Icon className="h-4.5 w-4.5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1">
                                                        <p className="font-semibold text-sm text-[color:var(--ws-text-primary)]">{item.label}</p>
                                                        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-70 group-hover:translate-x-0 group-hover:translate-y-0 transition" />
                                                    </div>
                                                    <p className="text-xs text-[color:var(--ws-text-tertiary)] mt-0.5">{item.hint}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>

                        {/* Workspace activity timeline */}
                        <section aria-labelledby="workspace-activity-heading" className="rounded-2xl border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] shadow-[color:var(--ws-card-shadow)]">
                            <header className="flex items-center justify-between gap-3 px-5 py-4 md:px-6 md:py-5 border-b border-[color:var(--ws-border)]">
                                <div className="flex items-center gap-2.5">
                                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--brand-teal)_16%,var(--ws-panel))] text-[color:var(--brand-teal)]">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <h2 id="workspace-activity-heading" className="text-base md:text-lg font-semibold text-[color:var(--ws-text-primary)]">
                                        Workspace activity
                                    </h2>
                                </div>
                                <span className="text-xs text-[color:var(--ws-text-tertiary)]">
                                    {workspaceActivity.length} recent item{workspaceActivity.length === 1 ? '' : 's'}
                                </span>
                            </header>
                            <div className="p-4 md:p-5">
                                {workspaceActivity.length > 0 ? (
                                    <div className="space-y-3">
                                        {workspaceActivity.slice(0, 10).map((item) => (
                                            <div
                                                key={item.id}
                                                className="rounded-xl border border-[color:var(--ws-border)] bg-[color:var(--ws-surface-secondary)] p-4 md:p-5 hover:border-[color:var(--ws-border-strong)] transition-colors"
                                            >
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-[color:var(--ws-text-primary)] line-clamp-3">
                                                            {item.summary}
                                                        </p>
                                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                            {item.actor_display_name ? (
                                                                <span className="inline-flex items-center text-[11px] text-[color:var(--ws-text-tertiary)]">
                                                                    {item.actor_display_name}
                                                                </span>
                                                            ) : null}
                                                            <time className="inline-block text-[11px] text-[color:var(--ws-text-tertiary)] tabular-nums">
                                                                {formatDateTime(item.created_at)}
                                                            </time>
                                                        </div>
                                                    </div>
                                                    <span className={`inline-flex shrink-0 items-center self-start gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(item.event_type)}`}>
                                                        <Activity className="h-3 w-3" />
                                                        {item.event_type.split('.').pop() || item.event_type}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState
                                        icon={Clock}
                                        title="No workspace activity yet"
                                        description="As things happen — invoices sent, projects updated, approvals decided — they'll appear here with a clean timeline."
                                    />
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {/* PROJECTS */}
                {activeTab === 'projects' && (
                    <DataCardList
                        rows={portal.projects}
                        icon={FolderKanban}
                        empty={{ title: 'No projects yet', description: "When your provider shares a project with you, you'll see it here with progress, next steps, and project detail access." }}
                        render={(p) => (
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-base md:text-lg font-semibold text-[color:var(--ws-text-primary)]">{p.name}</h3>
                                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeClass(p.status)}`}>
                                            {p.stage || p.status}
                                        </span>
                                    </div>
                                    <div className="mt-4 max-w-lg">
                                        <div className="flex items-center justify-between text-[11px] font-medium text-[color:var(--ws-text-tertiary)] mb-1.5">
                                            <span>Progress</span>
                                            <span>{p.progress}%</span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--ws-surface-secondary)] border border-[color:var(--ws-border)]">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-[color:var(--brand-teal)] to-[color:var(--info)]"
                                                style={{ width: `${Math.max(0, Math.min(100, p.progress))}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="shrink-0 sm:text-right">
                                    <a
                                        href={p.viewUrl}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--ws-surface-secondary)] hover:bg-[color:var(--ws-panel-hover)] border border-[color:var(--ws-border-strong)] px-3.5 py-2 text-xs md:text-sm font-semibold text-[color:var(--ws-text-primary)]"
                                    >
                                        Open project
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </a>
                                </div>
                            </div>
                        )}
                    />
                )}

                {/* INVOICES */}
                {activeTab === 'invoices' && (
                    <DataCardList
                        rows={portal.invoices}
                        icon={Landmark}
                        empty={{ title: 'No invoices', description: "You don't have any invoices in this workspace yet. Once your provider sends one, it will appear here with a secure payment link." }}
                        render={(i) => (
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--ws-text-tertiary)]">Invoice</p>
                                        <p className="mt-0.5 text-base font-semibold text-[color:var(--ws-text-primary)]">{i.invoiceNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--ws-text-tertiary)]">Due date</p>
                                        <p className="mt-0.5 text-sm text-[color:var(--ws-text-primary)]">{formatDate(i.dueDate)}</p>
                                        <p className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(i.status)}`}>
                                            {i.status.replace('_', ' ')}
                                        </p>
                                    </div>
                                    <div className="sm:text-right">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--ws-text-tertiary)]">Amount due</p>
                                        <p className="mt-0.5 text-xl md:text-2xl font-bold tracking-tight text-[color:var(--ws-text-primary)]">{money(i.total)}</p>
                                    </div>
                                </div>
                                <div className="shrink-0 sm:text-right">
                                    {i.status !== 'paid' && i.payUrl ? (
                                        <a
                                            href={i.payUrl}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--brand-teal)] hover:opacity-90 px-4 py-2 text-xs md:text-sm font-semibold text-white"
                                        >
                                            Pay invoice
                                            <ArrowUpRight className="h-3.5 w-3.5" />
                                        </a>
                                    ) : i.status !== 'paid' ? (
                                        <span className="inline-flex items-center rounded-lg border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] px-3.5 py-2 text-xs font-medium text-[color:var(--ws-text-secondary)]">
                                            Payment link will appear when ready
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[color:var(--success)] px-3.5 py-2 text-xs font-semibold border border-[color-mix(in_srgb,var(--success)_24%,transparent)]">
                                            <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    />
                )}

                {/* QUOTES (only shown when data present) */}
                {activeTab === 'quotes' && (
                    <DataCardList
                        rows={portal.quotes ?? []}
                        icon={FileText}
                        empty={{ title: 'No pending quotes', description: 'Any estimates or quotes shared with you will appear here for review and acceptance.' }}
                        render={(q: any) => (
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--ws-text-tertiary)]">Quote</p>
                                        <p className="mt-0.5 text-base font-semibold text-[color:var(--ws-text-primary)]">{q.quoteNumber}</p>
                                        <p className="mt-0.5 text-sm text-[color:var(--ws-text-secondary)]">{q.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--ws-text-tertiary)]">Valid until</p>
                                        <p className="mt-0.5 text-sm text-[color:var(--ws-text-primary)]">{q.validUntil ? formatDate(q.validUntil) : '—'}</p>
                                        <p className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(q.status)}`}>
                                            {q.status}
                                        </p>
                                    </div>
                                    <div className="sm:text-right">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--ws-text-tertiary)]">Amount</p>
                                        <p className="mt-0.5 text-xl md:text-2xl font-bold tracking-tight text-[color:var(--ws-text-primary)]">{money(q.totalAmount)}</p>
                                    </div>
                                </div>
                                <div className="shrink-0 sm:text-right">
                                    {q.viewUrl ? (
                                        <a
                                            href={q.viewUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--ws-surface-secondary)] hover:bg-[color:var(--ws-panel-hover)] border border-[color:var(--ws-border-strong)] px-3.5 py-2 text-xs md:text-sm font-semibold text-[color:var(--ws-text-primary)]"
                                        >
                                            Review quote <ArrowUpRight className="h-3.5 w-3.5" />
                                        </a>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    />
                )}

                {/* CONTRACTS */}
                {activeTab === 'contracts' && (
                    <DataCardList
                        rows={portal.contracts}
                        icon={Signature}
                        empty={{ title: 'No contracts', description: "Contracts shared with you will appear here for secure review and signing. Nothing requires your attention right now." }}
                        render={(c) => (
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-base md:text-lg font-semibold text-[color:var(--ws-text-primary)]">{c.title}</h3>
                                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeClass(c.status)}`}>
                                            {c.status.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[color:var(--ws-text-tertiary)]">
                                        {c.contractNumber ? <span>Contract no. <span className="font-medium text-[color:var(--ws-text-secondary)]">{c.contractNumber}</span></span> : null}
                                        <span>Last updated <span className="font-medium text-[color:var(--ws-text-secondary)]">{formatDate(c.updatedAt)}</span></span>
                                    </div>
                                </div>
                                <div className="shrink-0 sm:text-right">
                                    {c.actionUrl ? (
                                        <a
                                            href={c.actionUrl}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--brand-teal)] hover:opacity-90 px-4 py-2 text-xs md:text-sm font-semibold text-white"
                                        >
                                            Review & sign <ArrowUpRight className="h-3.5 w-3.5" />
                                        </a>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--ws-surface-secondary)] border border-[color:var(--ws-border)] px-3.5 py-2 text-xs font-medium text-[color:var(--ws-text-tertiary)]">
                                            <CheckCircle2 className="h-3.5 w-3.5" /> No action required
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    />
                )}

                {/* DOCUMENTS */}
                {activeTab === 'documents' && (
                    <DataCardList
                        rows={portal.documents}
                        icon={FileCheck}
                        empty={{ title: 'No documents shared', description: "Documents your team explicitly shares will appear here. Private workspace files are never listed by default." }}
                        render={(d) => (
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1 flex items-start gap-3">
                                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[color:var(--ws-border)] bg-[color:var(--ws-surface-secondary)] text-[color:var(--ws-text-tertiary)]">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-base font-semibold text-[color:var(--ws-text-primary)]">{d.name}</p>
                                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[color:var(--ws-text-tertiary)]">
                                            <span>Type: <span className="font-medium text-[color:var(--ws-text-secondary)]">{d.documentType}</span></span>
                                            <span>Updated: <span className="font-medium text-[color:var(--ws-text-secondary)]">{formatDate(d.updatedAt)}</span></span>
                                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(d.status)}`}>{d.status}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="shrink-0 sm:text-right">
                                    <button
                                        onClick={() => setDocumentPreview({ name: d.name, url: d.viewUrl })}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--ws-surface-secondary)] hover:bg-[color:var(--ws-panel-hover)] border border-[color:var(--ws-border-strong)] px-3.5 py-2 text-xs md:text-sm font-semibold text-[color:var(--ws-text-primary)]"
                                    >
                                        Preview
                                    </button>
                                </div>
                            </div>
                        )}
                    />
                )}

                {/* MESSAGES */}
                {activeTab === 'messages' && (
                    <div className="rounded-2xl border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] shadow-[color:var(--ws-card-shadow)] overflow-hidden flex flex-col max-h-[calc(100vh-180px)] min-h-[560px]">
                        <header className="flex items-center justify-between gap-3 px-5 py-4 md:px-6 md:py-5 border-b border-[color:var(--ws-border)]">
                            <div className="flex items-center gap-2.5">
                                <div className="grid h-8 w-8 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--brand-teal)_16%,var(--ws-panel))] text-[color:var(--brand-teal)]">
                                    <MessageSquare className="h-4 w-4" />
                                </div>
                                <div>
                                    <h2 className="text-base md:text-lg font-semibold text-[color:var(--ws-text-primary)]">Messages</h2>
                                    <p className="text-xs text-[color:var(--ws-text-tertiary)]">
                                        {portal.projects.length ? 'Reply within the context of a project' : 'Create a project first to enable messages'}
                                    </p>
                                </div>
                            </div>
                        </header>

                        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-[color:var(--ws-border)] bg-[color:var(--ws-surface-secondary)]">
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[color:var(--ws-text-tertiary)] mb-1.5">
                                Project context
                            </label>
                            <select
                                value={projectId}
                                onChange={(event) => setProjectId(event.target.value)}
                                className="w-full max-w-md rounded-lg border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] px-3 py-2 text-sm text-[color:var(--ws-text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                                disabled={!portal.projects.length}
                            >
                                {portal.projects.length ? (
                                    portal.projects.map((project) => (
                                        <option key={project.id} value={project.id}>{project.name}</option>
                                    ))
                                ) : (
                                    <option value="">No projects available</option>
                                )}
                            </select>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 space-y-3 min-h-[280px] bg-[color:var(--ws-surface-secondary)]">
                            {messages.length > 0 ? (
                                messages.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`flex ${item.is_client ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[85%] sm:max-w-[72%] rounded-2xl px-4 py-3 shadow-sm ${
                                                item.is_client
                                                    ? 'rounded-br-md bg-[color-mix(in_srgb,var(--brand-teal)_18%,var(--ws-panel))] border border-[color-mix(in_srgb,var(--brand-teal)_26%,transparent)] text-[color:var(--ws-text-primary)]'
                                                    : 'rounded-bl-md bg-[color:var(--ws-panel)] border border-[color:var(--ws-border)] text-[color:var(--ws-text-primary)]'
                                            }`}
                                        >
                                            <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[color:var(--ws-text-tertiary)]">
                                                <span className="font-medium text-[color:var(--ws-text-secondary)]">{item.author_name}</span>
                                                <span>· {item.projectName}</span>
                                                <time className="ml-auto">{formatDateTime(item.created_at)}</time>
                                            </div>
                                            <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{item.content}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full grid place-items-center py-16 px-4 text-center">
                                    <div>
                                        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] text-[color:var(--ws-text-tertiary)]">
                                            <MessageSquare className="h-6 w-6" />
                                        </div>
                                        <h3 className="font-semibold text-[color:var(--ws-text-primary)]">No messages yet</h3>
                                        <p className="mt-1.5 text-sm text-[color:var(--ws-text-tertiary)] max-w-sm mx-auto">
                                            Send a message to get a conversation started. Replies from the team will appear right here.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <form onSubmit={sendMessage} className="border-t border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] p-4 md:p-5 space-y-3">
                            <textarea
                                value={message}
                                onChange={(event) => setMessage(event.target.value)}
                                placeholder={projectId ? 'Write a message to your team…' : 'Choose a project above to start messaging'}
                                className="w-full rounded-xl border border-[color:var(--ws-border)] bg-[color:var(--ws-surface-secondary)] px-4 py-3 text-sm text-[color:var(--ws-text-primary)] placeholder:text-[color:var(--ws-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)] resize-none"
                                rows={3}
                                disabled={!projectId}
                            />
                            <div className="flex items-center justify-end gap-2">
                                <p className="mr-auto text-[11px] text-[color:var(--ws-text-tertiary)]">
                                    {message.length > 0 ? `${message.length}/10000` : 'Messages are recorded in your shared project timeline'}
                                </p>
                                <button
                                    type="submit"
                                    disabled={!message.trim() || !projectId || sending}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--brand-teal)] hover:opacity-90 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                >
                                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    Send message
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* DOCUMENT PREVIEW MODAL */}
            {documentPreview ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-sm" onClick={() => setDocumentPreview(null)}>
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label={documentPreview.name}
                        onClick={(e) => e.stopPropagation()}
                        className="flex h-[88vh] md:h-[85vh] w-full max-w-6xl flex-col rounded-2xl border border-[color:var(--ws-border)] bg-[color:var(--ws-panel)] shadow-2xl"
                    >
                        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--ws-border)] px-4 py-3 md:px-5 md:py-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[color:var(--ws-border)] bg-[color:var(--ws-surface-secondary)] text-[color:var(--ws-text-tertiary)]">
                                    <FileText className="h-4 w-4" />
                                </div>
                                <p className="truncate text-sm font-semibold text-[color:var(--ws-text-primary)]">{documentPreview.name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={documentPreview.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--ws-surface-secondary)] hover:bg-[color:var(--ws-panel-hover)] border border-[color:var(--ws-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ws-text-primary)]"
                                >
                                    Open separately <ArrowUpRight className="h-3.5 w-3.5" />
                                </a>
                                <button
                                    onClick={() => setDocumentPreview(null)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--ws-border)] hover:bg-[color:var(--ws-panel-hover)] text-[color:var(--ws-text-primary)]"
                                    aria-label="Close preview"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <iframe
                            title={documentPreview.name}
                            src={documentPreview.url}
                            className="min-h-0 flex-1 w-full rounded-b-2xl bg-white text-black"
                        />
                    </div>
                </div>
            ) : null}
        </Shell>
    );
}
