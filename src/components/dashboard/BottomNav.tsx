import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Briefcase,
    MessageSquare,
    Menu,
    DollarSign
} from 'lucide-react';
import { NavItem, UserRole } from '../../types';

interface BottomNavProps {
    activeTab: string;
    onNavigate: (href: string) => void;
    onToggleMenu: () => void;
    unreadCount?: number;
    userRole?: UserRole; // Add user role
}

const BottomNav: React.FC<BottomNavProps> = ({
    activeTab,
    onNavigate,
    onToggleMenu,
    unreadCount = 0,
    userRole = 'client'
}) => {
    const router = useRouter();

    // Define the core top-level mobile destinations
    // We limit to 5 items max for standard bottom nav patterns
    const MOBILE_NAV_ITEMS = [
        { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Projects', href: '/dashboard/projects', icon: Briefcase },
        { label: 'Messages', href: '/dashboard/messages', icon: MessageSquare },
        { label: 'Finance', href: '/dashboard/finance', icon: DollarSign },
    ];

    const handleNavClick = (href: string) => {
        onNavigate(href);
        router.push(href);
    };

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 pb-safe z-50 h-[calc(env(safe-area-inset-bottom,20px)+64px)]">
            <div className="flex justify-around items-center h-16">
                {MOBILE_NAV_ITEMS.map((item) => {
                    const isActive = activeTab === item.href;
                    return (
                        <button
                            key={item.href}
                            onClick={() => handleNavClick(item.href)}
                            className={`flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform ${isActive ? 'text-teal-400' : 'text-slate-400 hover:text-slate-300'
                                }`}
                        >
                            <div className="relative">
                                <item.icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                                {item.href === '/dashboard/messages' && unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] font-medium tracking-wide">
                                {item.label}
                            </span>
                        </button>
                    );
                })}

                {/* 'More' / Menu toggle */}
                <button
                    onClick={onToggleMenu}
                    className="flex flex-col items-center justify-center w-full h-full space-y-1 text-slate-500 hover:text-slate-300 active:scale-95 transition-transform"
                >
                    <Menu className="w-6 h-6" />
                    <span className="text-[10px] font-medium tracking-wide">Menu</span>
                </button>
            </div>
        </div>
    );
};

export default BottomNav;
