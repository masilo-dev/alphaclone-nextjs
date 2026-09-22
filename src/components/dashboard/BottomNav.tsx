'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { UserRole } from '../../types';
import { Briefcase, House, Layers, Mail, Plus } from 'lucide-react';
import { MOBILE_BOTTOM_DESTINATIONS, isMobileBottomActive } from '@/config/responsive/mobileNav';
import { usePWA } from '@/contexts/PWAContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MobileMoreSheet from './responsive/MobileMoreSheet';
import MobileCreateSheet from './responsive/MobileCreateSheet';

interface BottomNavProps {
  activeTab: string;
  onNavigate: (href: string) => void;
  onToggleMenu: () => void;
  unreadCount?: number;
  userRole?: UserRole;
}

type CompanionNavItem = {
  moduleId: string;
  label: string;
  href: string;
  icon: typeof House;
  matchPrefixes: string[];
};

function companionDestinations(): CompanionNavItem[] {
  return [
    { moduleId: 'home', label: 'Home', href: '/dashboard', icon: House, matchPrefixes: ['/dashboard'] },
    { moduleId: 'work', label: 'Work', href: '/dashboard/projects', icon: Briefcase, matchPrefixes: ['/dashboard/projects', '/dashboard/business/projects', '/dashboard/tasks', '/dashboard/business/tasks', '/dashboard/calendar', '/dashboard/business/calendar'] },
    { moduleId: 'create', label: 'Create', href: '#create', icon: Plus, matchPrefixes: [] },
    { moduleId: 'inbox', label: 'Inbox', href: '/dashboard/comms', icon: Mail, matchPrefixes: ['/dashboard/comms', '/dashboard/mail', '/dashboard/messages', '/dashboard/business/messages', '/dashboard/notifications'] },
    { moduleId: 'more', label: 'More', href: '#more', icon: Layers, matchPrefixes: [] },
  ];
}

/**
 * Mobile navigation. Installed AlphaClone Companion always uses the canonical
 * Home / Work / Create / Inbox / More layout. Normal mobile browser keeps the
 * existing responsive navigation contract.
 */
const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onNavigate,
  onToggleMenu: _onToggleMenu,
  unreadCount = 0,
  userRole = 'client',
}) => {
  const { isPWA } = usePWA();
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const destinations = useMemo(() => {
    if (isPWA) return companionDestinations();
    return MOBILE_BOTTOM_DESTINATIONS.map((item) => ({
      moduleId: item.id,
      label: item.label,
      href: item.hrefForRole(userRole),
      icon: item.icon,
      matchPrefixes: item.matchPrefixesForRole(userRole),
    }));
  }, [isPWA, userRole]);

  useEffect(() => {
    if (!moreOpen && !createOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreOpen(false);
        setCreateOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen, createOpen]);

  const handleNavClick = (href: string, moduleId: string) => {
    if (moduleId === 'create') {
      setCreateOpen(true);
      return;
    }
    if (moduleId === 'more') {
      setMoreOpen(true);
      return;
    }
    // The dashboard parent owns route state and performs the single navigation.
    // Calling router.push here as well produced duplicate transitions on mobile.
    onNavigate(href);
  };

  const isItemActive = (item: (typeof destinations)[number]) => {
    if (item.moduleId === 'more') return moreOpen;
    if (item.moduleId === 'create') return createOpen;
    if (isPWA) {
      if (item.moduleId === 'home') return activeTab === '/dashboard' || activeTab === '/dashboard/business';
      return item.matchPrefixes.some((prefix) => activeTab === prefix || activeTab.startsWith(`${prefix}/`));
    }
    const legacy = MOBILE_BOTTOM_DESTINATIONS.find((d) => d.id === item.moduleId);
    return legacy ? isMobileBottomActive(activeTab, legacy, userRole) : activeTab === item.href;
  };

  return (
    <>
      <nav
        aria-label="Primary"
        data-tour="mobile-nav"
        className="ac-responsive-bottom-nav md:hidden fixed inset-x-0 bottom-0 z-50 native-bottom-bar ac-v3-floating border-t border-[var(--border-default)]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)' }}
      >
        <div className="flex items-center justify-around h-[58px] px-1">
          {destinations.map((item) => {
            const isMore = item.moduleId === 'more';
            const isCreate = item.moduleId === 'create';
            const isActive = isItemActive(item);
            const showBadge = unreadCount > 0 && item.moduleId === 'inbox';
            const Icon = item.icon;

            return (
              <button
                key={item.moduleId}
                type="button"
                onClick={() => handleNavClick(item.href, item.moduleId)}
                aria-label={t(item.label)}
                aria-current={!isMore && !isCreate && isActive ? 'page' : undefined}
                aria-expanded={isMore ? moreOpen : isCreate ? createOpen : undefined}
                aria-haspopup={isMore || isCreate ? 'dialog' : undefined}
                className={`native-tap relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 active:scale-[0.97] ${isCreate ? '-mt-4' : ''}`}
              >
                <div className="relative">
                  <span className={isCreate ? 'flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--ac-accent)] text-white shadow-lg shadow-blue-950/40' : ''}>
                  <Icon
                    className={`${isCreate ? 'h-6 w-6 text-white' : 'h-5 w-5'} ${!isCreate && isActive ? 'text-[var(--ac-accent)]' : !isCreate ? 'text-[var(--text-muted)]' : ''}`}
                    strokeWidth={isActive ? 2.35 : 1.8}
                    aria-hidden
                  />
                  </span>
                  {showBadge ? (
                    <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-[var(--error-500)] px-1 text-[9px] font-bold leading-4 text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  ) : null}
                </div>
                <span className={`max-w-[4.75rem] truncate text-[10px] leading-3 ${isActive ? 'font-semibold text-[var(--ac-accent)]' : 'text-[var(--text-muted)]'}`}>
                  {t(item.label)}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} userRole={userRole} onNavigate={onNavigate} />
      <MobileCreateSheet open={createOpen} onClose={() => setCreateOpen(false)} userRole={userRole} onNavigate={onNavigate} />
    </>
  );
};

export default BottomNav;
