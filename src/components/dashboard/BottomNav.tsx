'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole } from '../../types';
import { Layers } from 'lucide-react';
import {
  isPwaNavActive,
  resolveBottomNavItems,
  type PwaNavItem,
} from '@/config/pwaMobileNav';
import {
  MOBILE_BOTTOM_DESTINATIONS,
  isMobileBottomActive,
} from '@/config/responsive/mobileNav';
import { readPwaPreferences, subscribePwaPreferences } from '@/lib/pwa/pwaPreferences';
import { usePWA } from '@/contexts/PWAContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MobileMoreSheet from './responsive/MobileMoreSheet';

interface BottomNavProps {
  activeTab: string;
  onNavigate: (href: string) => void;
  onToggleMenu: () => void;
  unreadCount?: number;
  userRole?: UserRole;
}

const MORE_ITEM: PwaNavItem = {
  moduleId: 'more',
  label: 'More',
  href: '#more',
  icon: Layers,
  matchPrefixes: [],
  tileBg: 'bg-slate-500',
  tileBgMuted: 'bg-slate-500/20',
  labelActive: 'text-slate-300',
};

/**
 * Phone bottom navigation — user-configurable slots in PWA, fixed defaults in browser.
 */
const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onNavigate,
  onToggleMenu: _onToggleMenu,
  unreadCount = 0,
  userRole = 'client',
}) => {
  const router = useRouter();
  const { isPWA } = usePWA();
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);
  const [navPrefs, setNavPrefs] = useState(() => readPwaPreferences());

  useEffect(() => {
    return subscribePwaPreferences(() => setNavPrefs(readPwaPreferences()));
  }, []);

  const destinations = useMemo(() => {
    if (isPWA) {
      const items = resolveBottomNavItems(userRole, navPrefs.bottomNavModuleIds, { isPwa: true });
      const slots = items.slice(0, 4);
      return [...slots, MORE_ITEM];
    }
    return MOBILE_BOTTOM_DESTINATIONS.map((item) => ({
      moduleId: item.id,
      label: item.label,
      href: item.hrefForRole(userRole),
      icon: item.icon,
      matchPrefixes: item.matchPrefixesForRole(userRole),
      tileBg: 'bg-slate-500',
      tileBgMuted: 'bg-slate-500/20',
      labelActive: 'text-teal-300',
      isLegacyMore: item.id === 'more',
    }));
  }, [isPWA, navPrefs.bottomNavModuleIds, userRole]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const handleNavClick = (href: string, moduleId: string) => {
    if (moduleId === 'more') {
      setMoreOpen(true);
      return;
    }
    onNavigate(href);
    router.push(href);
  };

  const isItemActive = (item: (typeof destinations)[number]) => {
    if (item.moduleId === 'more') return moreOpen;
    if (isPWA) return isPwaNavActive(activeTab, item as PwaNavItem);
    const legacy = MOBILE_BOTTOM_DESTINATIONS.find((d) => d.id === item.moduleId);
    if (legacy) return isMobileBottomActive(activeTab, legacy, userRole);
    return activeTab === item.href;
  };

  return (
    <>
      <nav
        aria-label="Primary"
        className="ac-responsive-bottom-nav md:hidden fixed inset-x-0 bottom-0 z-50 ac-workspace-toolbar border-t border-[var(--ws-border)] native-bottom-bar bg-[var(--ws-toolbar)]/95 backdrop-blur-md"
        style={{ paddingBottom: 'min(env(safe-area-inset-bottom, 0px), 20px)' }}
      >
        <div className="flex justify-around items-center h-[52px] px-1">
          {destinations.map((item) => {
            const isMore = item.moduleId === 'more';
            const isActive = isItemActive(item);
            const showBadge = unreadCount > 0 && isMore;
            const Icon = item.icon;

            return (
              <button
                key={item.moduleId}
                type="button"
                onClick={() => handleNavClick(item.href, item.moduleId)}
                aria-label={t(item.label)}
                aria-current={!isMore && isActive ? 'page' : undefined}
                aria-expanded={isMore ? moreOpen : undefined}
                aria-haspopup={isMore ? 'dialog' : undefined}
                className="native-tap relative flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors min-w-0 py-1"
              >
                {isActive ? (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-7 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.6)]"
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
                    isActive ? 'text-teal-300 font-semibold' : 'text-[var(--ws-text-tertiary)]'
                  }`}
                >
                  {t(item.label)}
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
