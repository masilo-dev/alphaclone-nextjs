import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ChevronDown, Menu, ShieldAlert, Mic, HelpCircle, Activity, Sparkles, Loader2, Sun, Moon, Monitor } from 'lucide-react';
import Image from 'next/image';
import { LOGO_URL } from '../../constants';
import { User } from '../../types';

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
    onToggleVoice
}) => {
    const router = useRouter();

    // Hidden if forcibly hidden (e.g. via parent routing logic)
    if (forceHidden) return null;

    const handleNavigation = (href: string) => {
        if (href !== '#') {
            router.push(href);
            if (onNavigate) onNavigate();

            // Auto-close sidebar on mobile after navigation
            if (typeof window !== 'undefined' && window.innerWidth < 768) {
                setSidebarOpen(false);
            }
        }
    };

    const handleSubNavigation = (href: string) => {
        router.push(href);
        if (onNavigate) onNavigate();

        // Auto-close sidebar on mobile after navigation
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    };

    // Lightweight inline theme handler — persisted to localStorage
    const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('dark');
    const applyTheme = (t: 'light' | 'dark' | 'auto') => {
        const root = document.documentElement;
        if (t === 'auto') {
            const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.toggle('dark', dark);
            root.classList.toggle('light', !dark);
        } else {
            root.classList.toggle('dark', t === 'dark');
            root.classList.toggle('light', t === 'light');
        }
    };
    const handleTheme = (t: 'light' | 'dark' | 'auto') => {
        setTheme(t);
        applyTheme(t);
        localStorage.setItem('ac-theme', t);
    };
    useEffect(() => {
        const saved = typeof window !== 'undefined'
            ? localStorage.getItem('ac-theme') as 'light' | 'dark' | 'auto' | null
            : null;
        if (saved) { setTheme(saved); applyTheme(saved); }
    }, []);

    return (
        <>
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside className={`
                fixed md:relative z-[60] h-full bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 shadow-2xl overflow-hidden will-change-transform
                ${sidebarOpen ? 'translate-x-0 w-64 pb-safe md:pb-0' : '-translate-x-full md:translate-x-0 w-0 md:w-20'}
            `}>
                <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-900">
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

                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5 custom-scrollbar transform-gpu">
                    {user.role === 'admin' && (
                        <div className="mb-4 px-2">
                            <button
                                onClick={() => handleNavigation('/dashboard/admin/tenants')}
                                className={`w-full flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center px-1'} py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-200 bg-gradient-to-r from-purple-600/20 to-teal-600/20 border border-teal-500/30 text-teal-400 hover:from-purple-600/30 hover:to-teal-600/30 hover:border-teal-400 shadow-lg shadow-teal-500/10 mb-2`}
                            >
                                <ShieldAlert className={`w-5 h-5 flex-shrink-0`} />
                                <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'} transition-all`}>Admin Panel</span>
                            </button>
                        </div>
                    )}
                    {navItems?.map((item, idx) => (
                        <div key={idx}>
                            <button
                                onClick={() => {
                                    if (item.comingSoon) return;
                                    if (item.href === '#') {
                                        // Parent item with subitems - do not navigate, just allow expansion
                                        return;
                                    } else {
                                        handleNavigation(item.href);
                                    }
                                }}
                                title={!sidebarOpen ? item.label : undefined}
                                className={`w-full flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center px-2'} py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden active:scale-95 touch-manipulation
                   ${activeTab === item.href
                                        ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                    }`}
                            >
                                {activeTab === item.href && <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />}
                                {item.icon && <item.icon className={`w-5 h-5 flex-shrink-0 ${activeTab === item.href ? 'text-white' : 'group-hover:text-teal-400 transition-colors'}`} />}
                                <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden md:block'} flex-1 text-left whitespace-nowrap`}>
                                    {item.label}
                                    {item.comingSoon && sidebarOpen && (
                                        <span className="ml-2 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter bg-slate-800 text-teal-400 border border-teal-500/30 rounded-md">
                                            Soon
                                        </span>
                                    )}
                                </span>
                                {/* Message counter badge */}
                                {item.href === '/dashboard/messages' && unreadMessageCount > 0 && (
                                    <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
                                        {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                                    </span>
                                )}
                                {('subItems' in item) && item.subItems && sidebarOpen && <ChevronDown className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />}
                            </button>

                            {/* Sub Items */}
                            {('subItems' in item) && item.subItems && sidebarOpen && (
                                <div className="ml-8 mt-1 space-y-1">
                                    {item.subItems.map((sub: { label: string; href: string }, sIdx: number) => (
                                        <button
                                            key={sIdx}
                                            onClick={() => handleSubNavigation(sub.href)}
                                            className={`block w-full text-left text-sm py-2 px-3 rounded-lg hover:bg-slate-800 transition-colors touch-manipulation
                           ${activeTab === sub.href ? 'text-teal-400 font-medium bg-slate-800/50' : 'text-slate-500 hover:text-white'}
                         `}
                                        >
                                            {sub.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-800 bg-slate-900 mt-auto space-y-2">
                    {/* Quick Activity & Help Icons (Small Layout) */}
                    {!sidebarOpen && (
                        <div className="flex flex-col items-center gap-4 mb-4 py-2">
                            {activeBgTasksCount > 0 && (
                                <div className="text-teal-400 animate-spin" title={`${activeBgTasksCount} Active Tasks`}>
                                    <Activity className="w-5 h-5" />
                                </div>
                            )}
                            {/* Voice & Help Removed Temporarily
                            <button 
                                onClick={onToggleVoice}
                                className={`p-2 rounded-xl transition-all ${isVoiceActive ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                                title="Voice Assistant"
                            >
                                <Mic className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={onStartTour}
                                className="text-slate-500 hover:text-white"
                                title="Need Help?"
                            >
                                <HelpCircle className="w-5 h-5" />
                            </button>
                            */}
                        </div>
                    )}

                    {/* Full Status/Actions (Open Layout) */}
                    {sidebarOpen && (
                        <div className="space-y-2 mb-4">
                            {/* Voice & Help Removed Temporarily
                            <button
                                onClick={onToggleVoice}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${
                                    isVoiceActive 
                                        ? 'bg-red-500/10 text-red-400 border border-red-500/30' 
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
                                }`}
                            >
                                <div className={`p-1.5 rounded-lg ${isVoiceActive ? 'bg-red-500/20' : 'bg-slate-800'}`}>
                                    <Mic className="w-4 h-4" />
                                </div>
                                <span className="font-medium">{isVoiceActive ? 'Assistant Active' : 'Voice Assistant'}</span>
                                {isVoiceActive && <span className="ml-auto w-2 h-2 bg-red-500 rounded-full animate-ping" />}
                            </button>

                            <button
                                onClick={onStartTour}
                                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                            >
                                <div className="p-1.5 rounded-lg bg-slate-800">
                                    <HelpCircle className="w-4 h-4" />
                                </div>
                                <span className="font-medium">Need Help?</span>
                            </button>
                            */}

                            {activeBgTasksCount > 0 && (
                                <div className="px-4 py-2.5 bg-teal-500/5 border border-teal-500/20 rounded-xl flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                                        <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black uppercase text-teal-400 tracking-widest leading-none">Status</p>
                                        <p className="text-xs text-slate-300 font-medium truncate mt-1">
                                            {activeBgTasksCount} Task{activeBgTasksCount > 1 ? 's' : ''} in progress
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Theme Toggle — only visible when sidebar expanded */}
                    {sidebarOpen && (
                        <div className="mb-3">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 px-1 mb-2">Appearance</p>
                            <div className="flex items-center gap-1 bg-slate-800/80 rounded-xl p-1 border border-slate-700/50">
                                <button
                                    onClick={() => handleTheme('light')}
                                    title="Light Mode"
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                                        theme === 'light' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'text-slate-500 hover:text-white hover:bg-slate-700'
                                    }`}
                                >
                                    <Sun className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Light</span>
                                </button>
                                <button
                                    onClick={() => handleTheme('dark')}
                                    title="Dark Mode"
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                                        theme === 'dark' ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30' : 'text-slate-500 hover:text-white hover:bg-slate-700'
                                    }`}
                                >
                                    <Moon className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Dark</span>
                                </button>
                                <button
                                    onClick={() => handleTheme('auto')}
                                    title="System Theme"
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                                        theme === 'auto' ? 'bg-teal-500/20 text-teal-300 border border-teal-400/30' : 'text-slate-500 hover:text-white hover:bg-slate-700'
                                    }`}
                                >
                                    <Monitor className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Auto</span>
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={onLogout}
                        className="flex items-center gap-3 text-slate-400 hover:text-red-400 w-full px-4 py-3 rounded-xl hover:bg-red-500/10 transition-colors group active:scale-95 touch-manipulation"
                    >
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className={`${sidebarOpen ? 'block' : 'hidden'}`}>Log Out</span>
                    </button>
                </div>
            </aside>
        </>
    );
});

Sidebar.displayName = 'Sidebar';
export default Sidebar;
