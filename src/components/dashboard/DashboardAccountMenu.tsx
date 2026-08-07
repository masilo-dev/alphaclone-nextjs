'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Globe, LogOut, Settings, Smartphone } from 'lucide-react';
import { User } from '@/types';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';
import { usePWA } from '@/contexts/PWAContext';
import { useIsMobile } from '@/hooks/useTouchGestures';
import { Avatar } from '@/components/ui/Avatar';

interface DashboardAccountMenuProps {
  user: User;
  onLogout: () => void;
  onSettings: () => void;
  onPwaSettings?: () => void;
}

export function DashboardAccountMenu({ user, onLogout, onSettings, onPwaSettings }: DashboardAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage, t } = useLanguage();
  const { isPWA } = usePWA();
  const isMobile = useIsMobile();
  const showMobileApp = isPWA || isMobile;

  const displayName = user.name || user.email?.split('@')[0] || 'User';

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('Account menu')}
        className="flex items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-800/60 pl-1 pr-2 py-1 hover:border-slate-600 hover:bg-slate-800 transition-colors"
      >
        <Avatar
          src={user.avatar}
          name={user.name}
          email={user.email}
          size={32}
          className="shrink-0"
        />
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-xl border border-slate-700/80 bg-slate-900 shadow-2xl shadow-black/40 overflow-hidden"
        >
          <div className="px-3 py-3 border-b border-slate-800/80">
            <p className="text-sm font-medium text-white truncate">{displayName}</p>
            <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
          </div>

          {showMobileApp && onPwaSettings ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPwaSettings();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800/80 transition-colors"
            >
              <Smartphone className="w-4 h-4 text-teal-400" />
              {t('Mobile app')}
            </button>
          ) : null}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSettings();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800/80 transition-colors"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            {t('Settings')}
          </button>

          <div className="px-3 py-2.5 border-t border-slate-800/80">
            <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              <Globe className="w-3 h-3" />
              {t('Language')}
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
              aria-label={t('Language')}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-teal-500/50"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-slate-900">
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 border-t border-slate-800/80 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t('Log out')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
