'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    CheckSquare,
    MessageSquare,
    Menu
} from 'lucide-react';
import { UserRole } from '../../types';
import { useLanguage } from '@/contexts/LanguageContext';

interface BottomNavProps {
    activeTab: string;
    onNavigate: (href: string) => void;
    onToggleMenu: () => void;
    unreadCount?: number;
    userRole?: UserRole;
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
        const crmPath = userRole === 'tenant_admin' ? '/dashboard/business/clients' : '/dashboard/crm';
        const messagesPath = userRole === 'tenant_admin' ? '/dashboard/business/messages' : '/dashboard/messages';
        return [
            { labelKey: 'Home', href: '/dashboard', icon: LayoutDashboard },
            { labelKey: 'CRM', href: crmPath, icon: Users },
            { labelKey: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
            { labelKey: 'Messages', href: messagesPath, icon: MessageSquare },
        ];
    }, [userRole]);

    const handleNavClick = (href: string) => {
        onNavigate(href);
        router.push(href);
    };

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 z-50 h-[calc(env(safe-area-inset-bottom,0px)+54px)] native-bottom-bar">
            <div className="flex justify-around items-center h-[54px]">
                {mobileNavItems.map((item) => {
                    const isActive = activeTab === item.href || (item.href !== '/dashboard' && activeTab.startsWith(item.href));
                    return (
                        <button
                            key={item.href}
                            onClick={() => handleNavClick(item.href)}
                            className={`native-tap flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-all ${
                                isActive ? 'text-teal-400' : 'text-slate-400 opacity-45 hover:opacity-100'
                            }`}
                        >
                            <div className="relative">
                                <item.icon className="w-6 h-6" />
                                {item.labelKey === 'Messages' && unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                )}
                            </div>
                            <span className="pwa-tab-label">
                                {t(item.labelKey)}
                            </span>
                        </button>
                    );
                })}

                {/* 'More' / Menu toggle */}
                <button
                    onClick={onToggleMenu}
                    className="native-tap flex flex-col items-center justify-center w-full h-full space-y-0.5 text-slate-400 opacity-45 hover:opacity-100 transition-all"
                >
                    <Menu className="w-6 h-6" />
                    <span className="pwa-tab-label">{t('More')}</span>
                </button>
            </div>
        </div>
    );
};

export default BottomNav;
