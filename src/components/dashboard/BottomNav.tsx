'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole } from '../../types';
import {
<<<<<<< HEAD
  MOBILE_BOTTOM_DESTINATIONS,
  isMobileBottomActive,
} from '@/config/responsive/mobileNav';
import MobileMoreSheet from './responsive/MobileMoreSheet';

interface BottomNavProps {
  activeTab: string;
  onNavigate: (href: string) => void;
  onToggleMenu: () => void;
  unreadCount?: number;
  userRole?: UserRole;
=======
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
>>>>>>> origin/main
}

/**
 * Phone bottom navigation — max five destinations:
 * Home · CRM · Work · Bonnie · More
 * "More" opens the job-grouped module catalogue (not a second sidebar clone).
 */
const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onNavigate,
  onToggleMenu: _onToggleMenu,
  unreadCount = 0,
  userRole = 'client',
}) => {
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

<<<<<<< HEAD
  const destinations = useMemo(
    () => MOBILE_BOTTOM_DESTINATIONS.filter((d) => d.id !== 'more' || true),
    [],
  );

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
=======
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
>>>>>>> origin/main
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

<<<<<<< HEAD
  const handleNavClick = (href: string, id: string) => {
    if (id === 'more') {
      setMoreOpen(true);
      return;
    }
    onNavigate(href);
    router.push(href);
  };

  return (
    <>
      <nav
        aria-label="Primary"
        className="md:hidden fixed inset-x-0 bottom-0 z-50 ac-workspace-toolbar border-t border-[var(--ws-border)] native-bottom-bar"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)' }}
      >
        <div className="flex justify-around items-stretch h-[56px] px-1">
          {destinations.map((item) => {
            const isMore = item.id === 'more';
            const isActive = isMore
              ? moreOpen
              : isMobileBottomActive(activeTab, item, userRole);
            const showBadge = unreadCount > 0 && item.id === 'more';
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.hrefForRole(userRole), item.id)}
                aria-label={item.label}
                aria-current={!isMore && isActive ? 'page' : undefined}
                aria-expanded={isMore ? moreOpen : undefined}
                aria-haspopup={isMore ? 'dialog' : undefined}
                className="native-tap relative flex flex-col items-center justify-center w-full min-h-11 gap-0.5 transition-colors min-w-0"
              >
                {isActive ? (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-teal-400"
                    aria-hidden
                  />
                ) : null}
                <div className="relative">
                  <Icon
                    className={`w-[1.125rem] h-[1.125rem] transition-colors ${
                      isActive ? 'text-teal-300' : 'text-[var(--ws-text-tertiary)]'
                    }`}
                    strokeWidth={isActive ? 2.25 : 1.75}
                    aria-hidden
                  />
                  {showBadge ? (
                    <span className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[var(--ws-toolbar)]" />
                  ) : null}
                </div>
                <span
                  className={`pwa-tab-label max-w-[4.75rem] truncate leading-tight ${
                    isActive ? 'text-teal-300' : 'text-[var(--ws-text-tertiary)]'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
=======
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
>>>>>>> origin/main
        </div>
      </nav>

      <MobileMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        userRole={userRole}
        onNavigate={onNavigate}
      />
    </>
  );
};

export default BottomNav;
