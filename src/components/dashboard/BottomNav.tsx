'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Settings2 } from 'lucide-react';
import { UserRole } from '../../types';
import { isPwaNavActive, resolveBottomNavItems } from '@/config/pwaMobileNav';
import { usePwaPreferences } from '@/hooks/usePwaPreferences';
import { usePWA } from '@/contexts/PWAContext';

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
    userRole = 'client',
}) => {
    const router = useRouter();
    const { isPWA } = usePWA();
    const { prefs } = usePwaPreferences();
    const mobileNavItems = useMemo(
        () => resolveBottomNavItems(userRole, prefs.bottomNavModuleIds),
        [userRole, prefs.bottomNavModuleIds],
    );

    const handleNavClick = (href: string) => {
        onNavigate(href);
        router.push(href);
    };

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 z-50 h-[calc(env(safe-area-inset-bottom,0px)+54px)] native-bottom-bar">
            <div className="flex justify-around items-center h-[54px]">
                {mobileNavItems.map((item) => {
                    const isActive = isPwaNavActive(activeTab, item);
                    const showBadge = item.label === 'Mail' && unreadCount > 0;
                    return (
                        <button
                            key={item.href}
                            type="button"
                            onClick={() => handleNavClick(item.href)}
                            aria-label={item.label}
                            aria-current={isActive ? 'page' : undefined}
                            className={`native-tap flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors ${
                                isActive ? 'text-teal-400' : 'text-slate-500'
                            }`}
                        >
                            <div className="relative">
                                <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.25 : 1.75} />
                                {showBadge ? (
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-slate-900" />
                                ) : null}
                            </div>
                            <span className="pwa-tab-label max-w-[4.5rem] truncate">{item.label}</span>
                        </button>
                    );
                })}

                <button
                    type="button"
                    onClick={() =>
                        isPWA ? handleNavClick('/dashboard/pwa-settings') : onToggleMenu()
                    }
                    onContextMenu={(e) => {
                        e.preventDefault();
                        handleNavClick('/dashboard/pwa-settings');
                    }}
                    aria-label={isPWA ? 'Mobile settings' : 'More'}
                    aria-current={activeTab === '/dashboard/pwa-settings' ? 'page' : undefined}
                    className={`native-tap flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors ${
                        activeTab === '/dashboard/pwa-settings' ? 'text-teal-400' : 'text-slate-500'
                    }`}
                >
                    {isPWA ? (
                        <Settings2 className="w-5 h-5" strokeWidth={1.75} />
                    ) : (
                        <Menu className="w-5 h-5" strokeWidth={1.75} />
                    )}
                    <span className="pwa-tab-label">{isPWA ? 'App' : 'More'}</span>
                </button>
            </div>
        </div>
    );
};

export default BottomNav;
