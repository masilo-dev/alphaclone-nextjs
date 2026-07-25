'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    LogOut, ChevronDown, ChevronRight, ShieldAlert, Activity, Loader2,
    Sun, Moon, X, Zap, Sparkles
} from 'lucide-react';
import Image from 'next/image';
import { LOGO_URL } from '../../constants';
import { User } from '../../types';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackgroundTasks, BackgroundTask } from '@/contexts/BackgroundTaskContext';
import { motion, AnimatePresence } from 'framer-motion';
import type { AcThemeMode } from '@/lib/applyAcTheme';
import { isPlatformAdminRole } from '@/lib/platformAdmin';
import { applyAcThemeClass, persistAcTheme, readStoredAcTheme } from '@/lib/applyAcTheme';
import { preferencesService } from '@/services/dashboardService';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────
interface SidebarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    user: User;
    navItems: any[];
    activeTab: string;
    setActiveTab: (tab: string) => void;
    unreadMessageCount: number;
    onLogout: () => void;
    forceHidden?: boolean;
    onNavigate?: () => void;
    activeBgTasksCount?: number;
    onStartTour?: () => void;
    isVoiceActive?: boolean;
    onToggleVoice?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────
const Sidebar = React.memo<SidebarProps>(({
    sidebarOpen,
    setSidebarOpen,
    user,
    navItems,
    activeTab,
    setActiveTab,
    unreadMessageCount,
    onLogout,
    forceHidden = false,
    onNavigate,
    activeBgTasksCount = 0,
}) => {
    const router = useRouter();
    const { t } = useLanguage();
    const { tasks, dismissTask } = useBackgroundTasks();

    // ── ALL hooks must be declared before any conditional return ─────────
    const [theme, setTheme] = useState<AcThemeMode>('dark');
    // Track which parent nav items are expanded  
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // Load + apply saved theme on mount / user change
    useEffect(() => {
        try {
            const stored = readStoredAcTheme(user.id);
            setTheme(stored);
            applyAcThemeClass(stored);
        } catch {
            applyAcThemeClass('dark');
        }
    }, [user.id]);

    useEffect(() => {
        const onRemote = () => setTheme(readStoredAcTheme(user.id));
        window.addEventListener('ac-theme-changed', onRemote);
        return () => window.removeEventListener('ac-theme-changed', onRemote);
    }, []);

    // Auto-expand parent if a child's href matches activeTab
    useEffect(() => {
        const autoExpand: Record<string, boolean> = {};
        navItems?.forEach((item: any) => {
            if (item.subItems?.some((sub: any) => activeTab.startsWith(sub.href.split('?')[0]))) {
                autoExpand[item.label] = true;
            }
        });
        setExpanded((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const [label, value] of Object.entries(autoExpand)) {
                if (value && !prev[label]) {
                    next[label] = true;
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [activeTab, navItems]);

    const handleTheme = useCallback((next: AcThemeMode) => {
        setTheme(next);
        applyAcThemeClass(next);
        persistAcTheme(next, user.id);
        void preferencesService.updateTheme(user.id, next);
    }, [user.id]);

    const navigate = useCallback((href: string) => {
        if (!href || href === '#') return;
        const path = href.split('?')[0]?.split('#')[0] || href;
        setActiveTab(path);
        router.push(href);
        if (onNavigate) onNavigate();
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    }, [router, onNavigate, setSidebarOpen, setActiveTab]);

    const settingsPath =
        user.role === 'tenant_admin' ? '/dashboard/business/settings' : '/dashboard/settings';

    const toggleExpanded = useCallback((label: string) => {
        setExpanded(prev => {
            const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
            if (isMobile) {
                // On mobile, close others when opening one
                return prev[label] ? {} : { [label]: true };
            }
            return { ...prev, [label]: !prev[label] };
        });
    }, []);

    const jumpNavOptions = useMemo(() => {
        const out: { label: string; href: string }[] = [];
        for (const item of navItems || []) {
            if (item.href && item.href !== '#') {
                out.push({ label: t(item.label), href: item.href });
            }
            if (item.subItems?.length) {
                for (const sub of item.subItems) {
                    if (sub.href) {
                        out.push({ label: `${t(item.label)}: ${t(sub.label)}`, href: sub.href });
                    }
                }
            }
        }
        if (isPlatformAdminRole(user.role)) {
            out.push({ label: t('Operations console'), href: '/dashboard/admin/operations' });
        }
        return out;
    }, [navItems, t, user.role]);

    // ── Safe to early-return after all hooks ──────────────────────────────
    if (forceHidden) return null;

    const initials = (user?.name || user?.email || 'U')
        .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

    const isItemActive = (item: any): boolean => {
        if (item.href !== '#' && activeTab === item.href) return true;
        if (item.subItems?.some((s: any) => activeTab.startsWith(s.href.split('?')[0]))) return true;
        return false;
    };

    return (
        <>
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside className={`
                fixed md:relative z-[60] h-full ac-workspace-sidebar border-r
                flex flex-col transition-all duration-200 overflow-hidden will-change-transform
                ${sidebarOpen ? 'translate-x-0 w-[240px] pb-safe md:pb-0' : '-translate-x-full md:translate-x-0 w-0 md:w-12'}
            `}>

                {/* ── Logo ── */}
                <div className={`${WORKSPACE.sidebar.logoHeight} flex items-center px-3 border-b border-[var(--ws-border)] shrink-0`}>
                    <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                        <Image src={LOGO_URL} alt="AlphaClone" width={28} height={28}
                            className="rounded-md object-contain flex-shrink-0" />
                        <span className={`font-semibold text-white text-[13px] tracking-tight transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                            {t('AlphaClone')}
                        </span>
                    </div>
                </div>

                {sidebarOpen && (
                    <div className="md:hidden px-3 pb-3 border-b border-[var(--ws-border)] shrink-0">
                        <label
                            htmlFor="ac-sidebar-jump"
                            className={cn(WORKSPACE.typography.sectionLabel, 'block mb-1.5')}
                        >
                            {t('Jump to page')}
                        </label>
                        <select
                            id="ac-sidebar-jump"
                            className="w-full min-h-11 px-3 py-2 rounded-[var(--ws-radius-lg)] bg-[var(--ws-panel)] border border-[var(--ws-border)] text-[13px] text-[var(--ws-text-primary,#fff)] focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                            defaultValue=""
                            onChange={(e) => {
                                const href = e.target.value;
                                if (href) {
                                    navigate(href);
                                    (e.target as HTMLSelectElement).value = '';
                                }
                            }}
                        >
                            <option value="" disabled>
                                {t('Select destination')}
                            </option>
                            {jumpNavOptions.map((opt) => (
                                <option key={`${opt.href}-${opt.label}`} value={opt.href}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* ── Nav ── */}

                <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 custom-scrollbar transform-gpu">
                    {/* Admin badge */}
                    {isPlatformAdminRole(user.role) && (
                        <div className="mb-2 px-0.5 space-y-0.5">
                            <button
                                onClick={() => navigate('/dashboard/admin/tenants')}
                                className={`${WORKSPACE.nav.item} ${sidebarOpen ? 'gap-2.5' : 'justify-center'} border border-[var(--ws-border)] text-teal-400`}
                            >
                                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                                <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>{t('Admin Panel')}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/dashboard/admin/operations')}
                                className={`${WORKSPACE.nav.item} ${sidebarOpen ? 'gap-2.5' : 'justify-center'}`}
                            >
                                <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>{t('Operations')}</span>
                            </button>
                        </div>
                    )}

                    {navItems?.map((item: any, idx: number) => {
                        const active = isItemActive(item);
                        const hasChildren = item.subItems && item.subItems.length > 0;
                        const isExpanded = expanded[item.label] ?? false;
                        const Icon = item.icon;

                        return (
                            <div key={idx} {...(item.label === 'Money Hub' ? { 'data-tour': 'money-hub-nav' } : {})}>
                                <button
                                    onClick={() => {
                                        if (item.comingSoon) return;
                                        if (hasChildren) {
                                            toggleExpanded(item.label);
                                            // Also navigate to the parent page
                                            if (item.href !== '#') navigate(item.href);
                                        } else {
                                            navigate(item.href);
                                        }
                                    }}
                                    title={!sidebarOpen ? t(item.label) : undefined}
                                    className={`${WORKSPACE.nav.item} ${active ? WORKSPACE.nav.itemActive : ''} ${sidebarOpen ? 'gap-2.5' : 'justify-center'} group relative touch-manipulation`}
                                >
                                    {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-[var(--ws-text-tertiary)] group-hover:text-white'}`} />}

                                    <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'} flex-1 text-left whitespace-nowrap`}>
                                        {t(item.label)}
                                        {item.comingSoon && sidebarOpen && (
                                            <span className="ml-2 px-1.5 py-0.5 text-xs font-black uppercase tracking-tighter bg-slate-800 text-teal-400 border border-teal-500/30 rounded-md">
                                                {t('Soon')}
                                            </span>
                                        )}
                                    </span>

                                    {/* Unread badge */}
                                    {(item.href === '/dashboard/messages' || item.href === '/dashboard/business/messages') && unreadMessageCount > 0 && (
                                        <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
                                            {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                                        </span>
                                    )}

                                    {/* Expand chevron */}
                                    {hasChildren && sidebarOpen && (
                                        <span className="ml-auto flex-shrink-0 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                                            <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                                        </span>
                                    )}
                                    {hasChildren && !sidebarOpen && (
                                        <ChevronRight className="w-3 h-3 text-slate-600 absolute right-0.5 bottom-0.5" />
                                    )}
                                </button>

                                {/* Sub-items: only show when expanded AND sidebar open */}
                                {hasChildren && sidebarOpen && isExpanded && (
                                    <div className="ml-3 mt-0.5 pl-2 border-l border-[var(--ws-border)] space-y-0.5">
                                        {item.subItems.map((sub: any, sIdx: number) => {
                                            const SubIcon = sub.icon;
                                            const subHref = sub.href.split('?')[0];
                                            const subActive = activeTab === subHref;
                                            return (
                                                <button
                                                    key={sIdx}
                                                    onClick={() => {
                                                        if (sub.comingSoon) return;
                                                        navigate(sub.href);
                                                    }}
                                                    className={`${WORKSPACE.nav.subItem} ${subActive ? WORKSPACE.nav.subItemActive : ''} gap-2`}
                                                >
                                                    {SubIcon && <SubIcon className="w-3.5 h-3.5 flex-shrink-0" />}
                                                    <span className="whitespace-nowrap">
                                                        {t(sub.label)}
                                                        {sub.comingSoon && (
                                                            <span className="ml-1.5 px-1 py-0.5 text-xs font-black uppercase bg-slate-800 text-teal-400 border border-teal-500/20 rounded">{t('Soon')}</span>
                                                        )}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* ── Bottom bar ── */}
                <div className="p-2 border-t border-[var(--ws-border)] mt-auto shrink-0">

                    {/* Operations HUD (Integrated) */}
                    {tasks.length > 0 && sidebarOpen && (
                        <div className="mb-3 border border-[var(--ws-border)] bg-[var(--ws-panel)] rounded-[var(--ws-radius-lg)] overflow-hidden">
                            <div className="px-3 py-2 border-b border-[var(--ws-border)] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-3.5 h-3.5 text-teal-400" />
                                    <span className={WORKSPACE.typography.sectionLabel}>{t('Operations')}</span>
                                </div>
                                <span className="text-[11px] font-medium text-teal-300 tabular-nums">
                                    {tasks.filter((task) => task.status === 'running').length} {t('Active')}
                                </span>
                            </div>
                            <div className="max-h-40 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                                {tasks.map((task) => (
                                    <div key={task.id} className="p-2 rounded-[var(--ws-radius)] bg-[var(--ws-hover)] border border-[var(--ws-border)] flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {task.status === 'running' ? (
                                                    <Loader2 className="w-3 h-3 text-teal-400 animate-spin" />
                                                ) : task.status === 'completed' ? (
                                                    <Activity className="w-3 h-3 text-emerald-400" />
                                                ) : (
                                                    <Activity className="w-3 h-3 text-rose-400" />
                                                )}
                                                <span className="text-[12px] font-medium text-[var(--ws-text-secondary)] truncate">{task.name}</span>
                                            </div>
                                            {(task.status === 'completed' || task.status === 'error') && (
                                                <button type="button" onClick={() => dismissTask(task.id)} className="p-1 hover:bg-[var(--ws-hover)] rounded-[var(--ws-radius)]" aria-label="Dismiss">
                                                    <X className="w-3 h-3 text-[var(--ws-text-tertiary)]" />
                                                </button>
                                            )}
                                        </div>
                                        {task.status === 'running' && (
                                            <div className="w-full bg-[var(--ws-canvas)] h-1 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-teal-500"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${task.progress || 50}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Collapsed simple indicator */}
                    {tasks.length > 0 && !sidebarOpen && (
                        <div className="mb-4 flex flex-col items-center gap-2">
                            <div className="relative">
                                <Activity className="w-5 h-5 text-teal-400 animate-pulse" />
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-teal-500 rounded-full" />
                            </div>
                        </div>
                    )}

                    {/* Theme quick-toggle (collapsed only shows icon cycle; expanded shows nothing — use Settings) */}
                    {!sidebarOpen && (
                        <button
                            type="button"
                            onClick={() => handleTheme(theme === 'dark' ? 'light' : 'dark')}
                            title={theme === 'dark' ? t('Switch to Light mode') : t('Switch to Dark mode')}
                            className="w-full flex items-center justify-center min-h-11 mb-1 text-[var(--ws-text-tertiary)] hover:text-amber-300 transition-colors rounded-[var(--ws-radius)] hover:bg-[var(--ws-hover)]"
                        >
                            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>
                    )}

                    {/* User row — identity only; account actions live in header menu */}
                    <div className={`flex ${sidebarOpen ? 'items-center gap-2' : 'flex-col items-center gap-1'}`}>
                        <button
                            type="button"
                            onClick={() => navigate(settingsPath)}
                            title={t('Settings')}
                            className={`flex items-center min-w-0 rounded-[var(--ws-radius-lg)] hover:bg-[var(--ws-hover)] transition-colors active:scale-[0.98] ${
                                sidebarOpen ? 'flex-1 gap-2.5 px-1.5 py-1.5' : 'justify-center p-1.5 min-h-11 min-w-11'
                            }`}
                        >
                            <span className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center font-semibold text-teal-300 text-[12px] flex-shrink-0">
                                {initials}
                            </span>
                            {sidebarOpen && (
                                <span className="flex-1 min-w-0 text-left">
                                    <span className="block text-[13px] font-semibold text-[var(--ws-text-primary,#fff)] truncate leading-tight">
                                        {user.name || user.email?.split('@')[0] || t('User')}
                                    </span>
                                    <span className="block text-[11px] text-[var(--ws-text-tertiary)] truncate capitalize">
                                        {user.role || t('member')}
                                    </span>
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={onLogout}
                            title={t('Log Out')}
                            aria-label={t('Log Out')}
                            className="p-2 min-h-11 min-w-11 rounded-[var(--ws-radius)] text-[var(--ws-text-tertiary)] hover:text-red-400 hover:bg-red-500/10 transition-colors active:scale-95 touch-manipulation shrink-0"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
});

Sidebar.displayName = 'Sidebar';
export default Sidebar;
