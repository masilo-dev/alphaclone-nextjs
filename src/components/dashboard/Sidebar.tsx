import React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ChevronDown, Menu, ShieldAlert } from 'lucide-react';
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
    onNavigate
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
        setActiveTab(href);
        if (onNavigate) onNavigate();

        // Auto-close sidebar on mobile after navigation
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    };

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
                fixed lg:relative z-[60] h-full bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 shadow-2xl overflow-hidden will-change-transform
                ${sidebarOpen || (typeof window !== 'undefined' && window.innerWidth >= 1024) ? 'translate-x-0 w-64 pb-safe lg:pb-0' : '-translate-x-full lg:translate-x-0 w-0 lg:w-20'}
            `}>
                <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-900">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <img
                            src={LOGO_URL}
                            alt="AlphaClone Logo"
                            className="w-9 h-9 rounded-xl object-contain flex-shrink-0"
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
                                <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'} transition-all`}>Global Command</span>
                            </button>
                        </div>
                    )}
                    {navItems.map((item, idx) => (
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
                                onMouseEnter={() => {
                                    // Proactively pre-fetch components for hover
                                    if (!item.comingSoon && item.href !== '#' && item.href.startsWith('/dashboard/')) {
                                        const tabName = item.href.split('/').pop();
                                        // Dynamically trigger the import that React.lazy uses in Dashboard.tsx
                                        // This fills the browser cache before the click
                                        if (tabName === 'tasks') import('./TasksTab');
                                        if (tabName === 'deals') import('./DealsTab');
                                        if (tabName === 'crm') import('./CRMTab');
                                        if (tabName === 'messages') import('./MessagesTab');
                                        if (tabName === 'finance') import('./FinanceTab');
                                        if (tabName === 'calendar') import('./CalendarComponent');
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

                <div className="p-4 border-t border-slate-800 bg-slate-900 mt-auto">
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
