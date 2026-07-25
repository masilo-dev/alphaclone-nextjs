'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole } from '../../types';
import {
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
}

/**
 * Phone bottom navigation — max five destinations:
 * Home · Customers · Work · Inbox · More
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

  const destinations = useMemo(
    () => MOBILE_BOTTOM_DESTINATIONS.filter((d) => d.id !== 'more' || true),
    [],
  );

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

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
        <div className="flex justify-around items-end h-[54px] px-1 pb-0.5">
          {destinations.map((item) => {
            const isMore = item.id === 'more';
            const isActive = isMore
              ? moreOpen
              : isMobileBottomActive(activeTab, item, userRole);
            const showBadge = unreadCount > 0 && item.id === 'inbox';
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
                className="native-tap flex flex-col items-center justify-end w-full h-full gap-0.5 transition-colors min-w-0"
              >
                <div className="relative">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-teal-500 scale-105 shadow-sm'
                        : 'bg-teal-500/15'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/80'}`}
                      strokeWidth={isActive ? 2.25 : 1.75}
                      aria-hidden
                    />
                  </div>
                  {showBadge ? (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-slate-900" />
                  ) : null}
                </div>
                <span
                  className={`pwa-tab-label max-w-[4.75rem] truncate leading-tight ${
                    isActive ? 'text-teal-300' : 'text-slate-500'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
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
