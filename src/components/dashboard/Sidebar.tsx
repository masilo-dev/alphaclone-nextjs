import React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ChevronDown, Menu } from 'lucide-react';
import { LOGO_URL } from '../../constants';
import { User } from '../../types';

interface SidebarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    isInCall: boolean;
    showSidebarDuringCall: boolean;
    user: User;
    navItems: any[];
    activeTab: string;
    setActiveTab: (tab: string) => void;
    unreadMessageCount: number;
    onLogout: () => void;
}

const Sidebar = React.memo<SidebarProps>(({
    sidebarOpen,
    setSidebarOpen,
    isInCall,
    showSidebarDuringCall,
    user,
    navItems,
    activeTab,
    setActiveTab,
    unreadMessageCount,
    onLogout
}) => {
    const router = useRouter();

    // Hidden during video calls unless manually toggled
    if (isInCall && !showSidebarDuringCall) return null;

    const handleNavigation = (href: string) => {
        if (href !== '#') {
            router.push(href);
            // Auto-close sidebar on mobile after navigation
            if (typeof window !== 'undefined' && window.innerWidth < 768) {
                setSidebarOpen(false);
            }
        }
    };

    const handleSubNavigation = (href: string) => {
        setActiveTab(href);
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

            <aside className={`${sidebarOpen
                ? 'w-72 translate-x-0'
                : 'w-0 -translate-x-full md:w-16 md:translate-x-0'
                } bg-slate-900 border-r border-slate-800 flex flex-col fixed md:relative ${isInCall ? 'z-[110]' : 'z-50'} h-full transition-all duration-300 shadow-2xl overflow-hidden will-change-transform`}>
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
                    {navItems.map((item, idx) => (
                        <div key={idx}>
                            <button
                                onClick={() => handleNavigation(item.href)}
                                title={!sidebarOpen ? item.label : undefined}
                                className={`w-full flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center px-2'} py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden active:scale-95 touch-manipulation
                   ${activeTab === item.href
                                        ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                    }`}
                            >
                                {activeTab === item.href && <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />}
                                {item.icon && <item.icon className={`w-5 h-5 flex-shrink-0 ${activeTab === item.href ? 'text-white' : 'group-hover:text-teal-400 transition-colors'}`} />}
                                <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden md:block'} flex-1 text-left whitespace-nowrap`}>{item.label}</span>
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
