'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    LogOut, ChevronDown, ShieldAlert, Activity, Loader2,
    Sun, Moon, Monitor, Settings
} from 'lucide-react';
import Image from 'next/image';
import { LOGO_URL } from '../../constants';
import { User } from '../../types';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';

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

type ThemeMode = 'light' | 'dark' | 'auto';

// ── Applies the theme class to <html> ──────────────────────────────────────
function applyThemeClass(t: ThemeMode) {
    const root = document.documentElement;
    if (t === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark',  prefersDark);
        root.classList.toggle('light', !prefersDark);
    } else {
        root.classList.toggle('dark',  t === 'dark');
        root.classList.toggle('light', t === 'light');
    }
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
    onStartTour,
    isVoiceActive = false,
    onToggleVoice,
}) => {
    const router = useRouter();
    const { language, setLanguage, languageFlag } = useLanguage();

    // ── Theme state — ALL hooks must come before any conditional returns ──
    const [theme, setTheme] = useState<ThemeMode>('dark');

    // Load theme from localStorage on mount & apply it
    useEffect(() => {
        try {
            const saved = localStorage.getItem('ac-theme') as ThemeMode | null;
            if (saved && ['light', 'dark', 'auto'].includes(saved)) {
                setTheme(saved);
                applyThemeClass(saved);
            } else {
                // Default: dark mode
                applyThemeClass('dark');
            }
        } catch {
            applyThemeClass('dark');
        }
    }, []);

    const handleTheme = useCallback((t: ThemeMode) => {
        setTheme(t);
        applyThemeClass(t);
        try { localStorage.setItem('ac-theme', t); } catch { /* ignore */ }
    }, []);

    // ── Navigation helpers ─────────────────────────────────────────────────
    const navigate = useCallback((href: string) => {
        if (!href || href === '#') return;
        router.push(href);
        if (onNavigate) onNavigate();
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    }, [router, onNavigate, setSidebarOpen]);

    // ── NOW safe to early-return after all hooks are declared ─────────────
    if (forceHidden) return null;

    // ── Avatar initials ────────────────────────────────────────────────────
    const initials = (user?.name || user?.email || 'U')
        .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

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
                {/* ── Logo header ── */}
                <div className="h-20 flex items-center px-5 border-b border-slate-800 bg-slate-900 shrink-0">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <Image
                            src={LOGO_URL}
                            alt="AlphaClone Logo"
                            width={36}
                            height={36}
                            className="rounded-xl object-contain flex-shrink-0"
                        />
                        <span className={`font-bold text-white text-lg tracking-tight transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                            AlphaClone
                        </span>
                    </div>
                </div>

                {/* ── Nav items ── */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5 custom-scrollbar transform-gpu">
                    {user.role === 'admin' && (
                        <div className="mb-3 px-1">
                            <button
                                onClick={() => navigate('/dashboard/admin/tenants')}
                                className={`w-full flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center px-1'} py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-gradient-to-r from-purple-600/20 to-teal-600/20 border border-teal-500/30 text-teal-400 hover:border-teal-400 mb-2`}
                            >
                                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                                <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'} transition-all`}>Admin Panel</span>
                            </button>
                        </div>
                    )}

                    {navItems?.map((item, idx) => (
                        <div key={idx}>
                            <button
                                onClick={() => {
                                    if (item.comingSoon) return;
                                    navigate(item.href);
                                }}
                                title={!sidebarOpen ? item.label : undefined}
                                className={`w-full flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center px-2'} py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative overflow-hidden active:scale-95 touch-manipulation
                                    ${activeTab === item.href
                                        ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                    }`}
                            >
                                {activeTab === item.href && <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />}
                                {item.icon && <item.icon className={`w-5 h-5 flex-shrink-0 ${activeTab === item.href ? 'text-white' : 'group-hover:text-teal-400 transition-colors'}`} />}
                                <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'} flex-1 text-left whitespace-nowrap`}>
                                    {item.label}
                                    {item.comingSoon && sidebarOpen && (
                                        <span className="ml-2 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter bg-slate-800 text-teal-400 border border-teal-500/30 rounded-md">
                                            Soon
                                        </span>
                                    )}
                                </span>
                                {item.href === '/dashboard/messages' && unreadMessageCount > 0 && (
                                    <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
                                        {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                                    </span>
                                )}
                                {('subItems' in item) && item.subItems && sidebarOpen && <ChevronDown className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />}
                            </button>

                            {('subItems' in item) && item.subItems && sidebarOpen && (
                                <div className="ml-8 mt-1 space-y-0.5">
                                    {item.subItems.map((sub: { label: string; href: string }, sIdx: number) => (
                                        <button
                                            key={sIdx}
                                            onClick={() => navigate(sub.href)}
                                            className={`block w-full text-left text-sm py-2 px-3 rounded-lg hover:bg-slate-800 transition-colors touch-manipulation
                                                ${activeTab === sub.href ? 'text-teal-400 font-medium bg-slate-800/50' : 'text-slate-500 hover:text-white'}`}
                                        >
                                            {sub.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </nav>

                {/* ── Bottom panel ── */}
                <div className="p-4 border-t border-slate-800 bg-slate-900 mt-auto space-y-2 shrink-0">

                    {/* Active tasks indicator */}
                    {activeBgTasksCount > 0 && sidebarOpen && (
                        <div className="px-3 py-2.5 bg-teal-500/5 border border-teal-500/20 rounded-xl flex items-center gap-3 mb-2">
                            <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center">
                                <Loader2 className="w-3.5 h-3.5 text-teal-400 animate-spin" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-black uppercase text-teal-400 tracking-widest leading-none">Status</p>
                                <p className="text-xs text-slate-300 font-medium truncate mt-0.5">
                                    {activeBgTasksCount} Task{activeBgTasksCount > 1 ? 's' : ''} in progress
                                </p>
                            </div>
                        </div>
                    )}
                    {activeBgTasksCount > 0 && !sidebarOpen && (
                        <div className="flex justify-center mb-2">
                            <Activity className="w-5 h-5 text-teal-400 animate-spin" />
                        </div>
                    )}

                    {/* ── Language selector ── */}
                    {sidebarOpen ? (
                        <div className="mb-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 px-1 mb-1.5">Language</p>
                            <div className="flex items-center gap-1 bg-slate-800/80 rounded-xl p-1 border border-slate-700/50">
                                {LANGUAGES.map(lang => (
                                    <button
                                        key={lang.code}
                                        onClick={() => setLanguage(lang.code)}
                                        title={lang.label}
                                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all ${
                                            language === lang.code
                                                ? 'bg-teal-500/20 text-teal-300 border border-teal-400/30'
                                                : 'text-slate-500 hover:text-white hover:bg-slate-700'
                                        }`}
                                    >
                                        <span className="text-sm leading-none">{lang.flag}</span>
                                        <span>{lang.code.toUpperCase()}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <button
                            title={`Language: ${language.toUpperCase()}`}
                            className="w-full flex items-center justify-center py-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <span className="text-lg leading-none">{languageFlag}</span>
                        </button>
                    )}

                    {/* ── Appearance (theme) toggle ── */}
                    {sidebarOpen ? (
                        <div className="mb-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 px-1 mb-1.5">Appearance</p>
                            <div className="flex items-center gap-1 bg-slate-800/80 rounded-xl p-1 border border-slate-700/50">
                                <button
                                    onClick={() => handleTheme('light')}
                                    title="Light Mode"
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                                        theme === 'light' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'text-slate-500 hover:text-white hover:bg-slate-700'
                                    }`}
                                >
                                    <Sun className="w-3.5 h-3.5" />
                                    <span>Light</span>
                                </button>
                                <button
                                    onClick={() => handleTheme('dark')}
                                    title="Dark Mode"
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                                        theme === 'dark' ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30' : 'text-slate-500 hover:text-white hover:bg-slate-700'
                                    }`}
                                >
                                    <Moon className="w-3.5 h-3.5" />
                                    <span>Dark</span>
                                </button>
                                <button
                                    onClick={() => handleTheme('auto')}
                                    title="System"
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                                        theme === 'auto' ? 'bg-teal-500/20 text-teal-300 border border-teal-400/30' : 'text-slate-500 hover:text-white hover:bg-slate-700'
                                    }`}
                                >
                                    <Monitor className="w-3.5 h-3.5" />
                                    <span>Auto</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => handleTheme(theme === 'dark' ? 'light' : 'dark')}
                            title={`Theme: ${theme}`}
                            className="w-full flex items-center justify-center py-2 text-slate-400 hover:text-white transition-colors"
                        >
                            {theme === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>
                    )}

                    {/* ── User avatar → Settings + Logout ── */}
                    <div className={`flex ${sidebarOpen ? 'items-center gap-3 px-1' : 'flex-col items-center gap-2'} pt-1`}>
                        {/* Avatar — click goes to Settings */}
                        <button
                            onClick={() => navigate('/dashboard/business/settings')}
                            title="Account Settings"
                            className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-violet-600 flex items-center justify-center font-bold text-white text-sm flex-shrink-0 hover:ring-2 hover:ring-teal-400 hover:ring-offset-2 hover:ring-offset-slate-900 transition-all active:scale-95"
                        >
                            {initials}
                        </button>

                        {sidebarOpen && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate leading-tight">
                                    {user.name || user.email?.split('@')[0] || 'User'}
                                </p>
                                <p className="text-[10px] text-slate-500 truncate capitalize">{user.role || 'member'}</p>
                            </div>
                        )}

                        {/* Logout */}
                        <button
                            onClick={onLogout}
                            title="Log Out"
                            className={`flex items-center gap-2 text-slate-500 hover:text-red-400 transition-colors group active:scale-95 touch-manipulation
                                ${sidebarOpen ? 'px-2 py-1.5 rounded-lg hover:bg-red-500/10' : 'p-2 rounded-lg hover:bg-red-500/10'}`}
                        >
                            <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform flex-shrink-0" />
                            {sidebarOpen && <span className="text-xs font-medium">Log out</span>}
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
});

Sidebar.displayName = 'Sidebar';
export default Sidebar;
