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
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';
import { useBackgroundTasks, BackgroundTask } from '@/contexts/BackgroundTaskContext';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import type { AcThemeMode } from '@/lib/applyAcTheme';
import { applyAcThemeClass, persistAcTheme, readStoredAcTheme } from '@/lib/applyAcTheme';

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
    const { language, setLanguage, languageCode, t } = useLanguage();
    const { tasks, dismissTask } = useBackgroundTasks();

    // ── ALL hooks must be declared before any conditional return ─────────
    const [theme, setTheme] = useState<AcThemeMode>('dark');
    // Track which parent nav items are expanded  
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // Load + apply saved theme on mount
    useEffect(() => {
        try {
            const t = readStoredAcTheme();
            setTheme(t);
            applyAcThemeClass(t);
        } catch {
            applyAcThemeClass('dark');
        }
    }, []);

    useEffect(() => {
        const onRemote = () => setTheme(readStoredAcTheme());
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
        setExpanded(prev => ({ ...prev, ...autoExpand }));
    }, [activeTab, navItems]);

    const handleTheme = useCallback((t: AcThemeMode) => {
        setTheme(t);
        applyAcThemeClass(t);
        persistAcTheme(t);
    }, []);

    const navigate = useCallback((href: string) => {
        if (!href || href === '#') return;
        router.push(href);
        if (onNavigate) onNavigate();
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    }, [router, onNavigate, setSidebarOpen]);

    const toggleExpanded = useCallback((label: string) => {
        setExpanded(prev => ({ ...prev, [label]: !prev[label] }));
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
        return out;
    }, [navItems, t]);

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
                fixed md:relative z-[60] h-full bg-slate-900 border-r border-slate-800
                flex flex-col transition-all duration-300 shadow-2xl overflow-hidden will-change-transform
                ${sidebarOpen ? 'translate-x-0 w-64 pb-safe md:pb-0' : '-translate-x-full md:translate-x-0 w-0 md:w-20'}
            `}>

                {/* ── Logo ── */}
                <div className="h-20 flex items-center px-5 border-b border-slate-800 bg-slate-900 shrink-0">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <Image src={LOGO_URL} alt="AlphaClone" width={36} height={36}
                            className="rounded-xl object-contain flex-shrink-0" />
                        <span className={`font-bold text-white text-lg tracking-tight transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                            {t('AlphaClone')}
                        </span>
                    </div>
                </div>

                {sidebarOpen && (
                    <div className="md:hidden px-3 pb-3 border-b border-slate-800 shrink-0">
                        <label htmlFor="ac-sidebar-jump" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                            {t('Jump to page')}
                        </label>
                        <select
                            id="ac-sidebar-jump"
                            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
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

                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5 custom-scrollbar transform-gpu">
                    {/* Admin badge */}
                    {user.role === 'admin' && (
                        <div className="mb-3 px-1">
                            <button
                                onClick={() => navigate('/dashboard/admin/tenants')}
                                className={`w-full flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center px-1'} py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-gradient-to-r from-indigo-600/20 to-teal-600/20 border border-teal-500/30 text-teal-400 hover:border-teal-400 mb-2`}
                            >
                                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                                <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>{t('Admin Panel')}</span>
                            </button>
                        </div>
                    )}

                    {navItems?.map((item: any, idx: number) => {
                        const active = isItemActive(item);
                        const hasChildren = item.subItems && item.subItems.length > 0;
                        const isExpanded = expanded[item.label] ?? false;
                        const Icon = item.icon;

                        return (
                            <div key={idx}>
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
                                    className={`w-full flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center px-2'} py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative overflow-hidden active:scale-95 touch-manipulation
                                        ${active
                                            ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                >
                                    {active && <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />}
                                    {Icon && <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'group-hover:text-teal-400 transition-colors'}`} />}

                                    <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'} flex-1 text-left whitespace-nowrap`}>
                                        {t(item.label)}
                                        {item.comingSoon && sidebarOpen && (
                                            <span className="ml-2 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter bg-slate-800 text-teal-400 border border-teal-500/30 rounded-md">
                                                {t('Soon')}
                                            </span>
                                        )}
                                    </span>

                                    {/* Unread badge */}
                                    {item.href === '/dashboard/messages' && unreadMessageCount > 0 && (
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
                                    <div className="ml-4 mt-0.5 pl-4 border-l border-slate-700/60 space-y-0.5">
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
                                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all touch-manipulation active:scale-95
                                                        ${subActive
                                                            ? 'bg-teal-600/20 text-teal-300 border border-teal-500/20'
                                                            : 'text-slate-500 hover:text-white hover:bg-slate-800'
                                                        }`}
                                                >
                                                    {SubIcon && <SubIcon className="w-3.5 h-3.5 flex-shrink-0" />}
                                                    <span className="whitespace-nowrap">
                                                        {t(sub.label)}
                                                        {sub.comingSoon && (
                                                            <span className="ml-1.5 px-1 py-0.5 text-[7px] font-black uppercase bg-slate-800 text-teal-400 border border-teal-500/20 rounded">{t('Soon')}</span>
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
                <div className="p-4 border-t border-slate-800 bg-slate-900 mt-auto shrink-0">

                    {/* Operations HUD (Integrated) */}
                    {tasks.length > 0 && sidebarOpen && (
                        <div className="mb-4 border border-teal-500/20 bg-teal-500/5 rounded-xl overflow-hidden">
                            <div className="px-3 py-2 bg-teal-500/10 border-b border-teal-500/20 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-3.5 h-3.5 text-teal-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-teal-400">{t('Operations')}</span>
                                </div>
                                <span className="px-1.5 py-0.5 rounded-md bg-teal-500/20 text-[9px] font-bold text-teal-300">
                                    {tasks.filter((task) => task.status === 'running').length} {t('Active')}
                                </span>
                            </div>
                            <div className="max-h-40 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                                {tasks.map((task) => (
                                    <div key={task.id} className="p-2 rounded-lg bg-slate-900/50 border border-slate-800 flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {task.status === 'running' ? (
                                                    <Loader2 className="w-3 h-3 text-teal-400 animate-spin" />
                                                ) : task.status === 'completed' ? (
                                                    <Activity className="w-3 h-3 text-emerald-400" />
                                                ) : (
                                                    <Activity className="w-3 h-3 text-rose-400" />
                                                )}
                                                <span className="text-[10px] font-bold text-slate-300 truncate">{task.name}</span>
                                            </div>
                                            {(task.status === 'completed' || task.status === 'error') && (
                                                <button onClick={() => dismissTask(task.id)} className="p-1 hover:bg-slate-800 rounded">
                                                    <X className="w-2.5 h-2.5 text-slate-500" />
                                                </button>
                                            )}
                                        </div>
                                        {task.status === 'running' && (
                                            <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
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
                            onClick={() => handleTheme(theme === 'dark' ? 'light' : 'dark')}
                            title={theme === 'dark' ? t('Switch to Light mode') : t('Switch to Dark mode')}
                            className="w-full flex items-center justify-center py-2 mb-2 text-slate-500 hover:text-amber-300 transition-colors rounded-lg hover:bg-slate-800"
                        >
                            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>
                    )}

                    {/* User row: avatar → settings, name/role, language flag, logout */}
                    <div className={`flex ${sidebarOpen ? 'items-center gap-2.5' : 'flex-col items-center gap-2'}`}>
                        {/* Avatar → Settings */}
                        <button
                            onClick={() => navigate('/dashboard/business/settings')}
                            title={t('Settings')}
                            className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-violet-600 flex items-center justify-center font-bold text-white text-sm flex-shrink-0 hover:ring-2 hover:ring-teal-400 hover:ring-offset-2 hover:ring-offset-slate-900 transition-all active:scale-95"
                        >
                            {initials}
                        </button>

                        {sidebarOpen && (
                            <>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white truncate leading-tight">
                                        {user.name || user.email?.split('@')[0] || t('User')}
                                    </p>
                                    <p className="text-[10px] text-slate-500 truncate capitalize">{user.role || t('member')}</p>
                                </div>

                                {/* Language switcher - immediate change */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const currentIdx = LANGUAGES.findIndex((l) => l.code === language);
                                        const nextLang = LANGUAGES[(currentIdx + 1) % LANGUAGES.length];
                                        setLanguage(nextLang.code);
                                        toast.success(`${t('Switched to')} ${nextLang.nativeName}`);
                                    }}
                                    title={t('Switch language')}
                                    className="text-[10px] font-bold min-w-[2rem] h-8 px-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 hover:border-teal-500/50 transition-colors flex items-center justify-center flex-shrink-0"
                                >
                                    {languageCode}
                                </button>
                            </>
                        )}

                        {/* Logout */}
                        <button
                            onClick={onLogout}
                            title={t('Log Out')}
                            className={`flex items-center gap-1.5 text-slate-500 hover:text-red-400 transition-colors group rounded-lg hover:bg-red-500/10 active:scale-95 touch-manipulation
                                ${sidebarOpen ? 'px-2 py-1.5' : 'p-2'}`}
                        >
                            <LogOut className="w-4 h-4 flex-shrink-0" />
                            {sidebarOpen && <span className="text-xs font-medium whitespace-nowrap">{t('Log out')}</span>}
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
});

Sidebar.displayName = 'Sidebar';
export default Sidebar;
