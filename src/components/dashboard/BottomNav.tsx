'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Briefcase,
    MessageSquare,
    Menu,
    DollarSign,
    Users,
    CheckSquare,
    Calendar
} from 'lucide-react';
import { UserRole } from '../../types';
import { useLanguage } from '@/contexts/LanguageContext';

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
    const { t } = useLanguage();

    const mobileNavItems = useMemo(() => {
        if (userRole === 'tenant_admin') {
            return [
                { labelKey: 'Home', href: '/dashboard', icon: LayoutDashboard },
                { labelKey: 'Contacts', href: '/dashboard/business/clients', icon: Users },
                { labelKey: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
                { labelKey: 'Calendar', href: '/dashboard/business/calendar', icon: Calendar },
            ];
        }

        return [
            { labelKey: 'Home', href: '/dashboard', icon: LayoutDashboard },
            { labelKey: 'Projects', href: '/dashboard/projects', icon: Briefcase },
            { labelKey: 'Messages', href: '/dashboard/messages', icon: MessageSquare },
            { labelKey: 'Finance', href: '/dashboard/finance', icon: DollarSign },
        ];
    }, [userRole]);

    const handleNavClick = (href: string) => {
        onNavigate(href);
        router.push(href);
    };

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 pb-safe z-50 h-[calc(env(safe-area-inset-bottom,20px)+64px)]">
            <div className="flex justify-around items-center h-16">
                {mobileNavItems.map((item) => {
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
                                {t(item.labelKey)}
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
                    <span className="text-[10px] font-medium tracking-wide">{t('Menu')}</span>
                </button>
            </div>
        </div>
    );
};

export default BottomNav;
