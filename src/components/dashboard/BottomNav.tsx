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

    const isSettingsActive = activeTab === '/dashboard/pwa-settings';

    return (
        <nav
            aria-label="Primary"
            className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 native-bottom-bar"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)' }}
        >
            <div className="flex justify-around items-end h-[54px] px-1 pb-0.5">
                {mobileNavItems.map((item) => {
                    const isActive = isPwaNavActive(activeTab, item);
                    const showBadge =
                        unreadCount > 0 && (item.moduleId === 'mail' || item.moduleId === 'chat');
                    return (
                        <button
                            key={item.href}
                            type="button"
                            onClick={() => handleNavClick(item.href)}
                            aria-label={item.label}
                            aria-current={isActive ? 'page' : undefined}
                            className="native-tap flex flex-col items-center justify-end w-full h-full gap-0.5 transition-colors"
                        >
                            <div className="relative">
                                <div
                                    className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm transition-all ${
                                        isActive ? `${item.tileBg} scale-105` : item.tileBgMuted
                                    }`}
                                >
                                    <item.icon
                                        className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/80'}`}
                                        strokeWidth={isActive ? 2.25 : 1.75}
                                    />
                                </div>
                                {showBadge ? (
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-slate-900" />
                                ) : null}
                            </div>
                            <span
                                className={`pwa-tab-label max-w-[4.75rem] truncate leading-tight ${
                                    isActive ? item.labelActive : 'text-slate-500'
                                }`}
                            >
                                {item.label}
                            </span>
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
                    aria-label={isPWA ? 'Mobile app settings' : 'More'}
                    aria-current={isSettingsActive ? 'page' : undefined}
                    className="native-tap flex flex-col items-center justify-end w-full h-full gap-0.5 transition-colors"
                >
                    <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm transition-all ${
                            isSettingsActive ? 'bg-slate-500 scale-105' : 'bg-slate-500/20'
                        }`}
                    >
                        {isPWA ? (
                            <Settings2 className="w-4 h-4 text-white" strokeWidth={isSettingsActive ? 2.25 : 1.75} />
                        ) : (
                            <Menu className="w-4 h-4 text-white/80" strokeWidth={1.75} />
                        )}
                    </div>
                    <span
                        className={`pwa-tab-label leading-tight ${isSettingsActive ? 'text-slate-300' : 'text-slate-500'}`}
                    >
                        {isPWA ? 'App' : 'More'}
                    </span>
                </button>
            </div>
        </nav>
    );
};

export default BottomNav;
