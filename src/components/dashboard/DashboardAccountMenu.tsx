'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

  const displayName = user.name || user.email?.split('@')[0] || 'User';

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const menu = document.getElementById('ac-account-menu-panel');
      if (menu?.contains(target)) return;
      setOpen(false);
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

  useEffect(() => {
    if (!open || !rootRef.current) {
      setAnchor(null);
      return;
    }
    const update = () => {
      const rect = rootRef.current!.getBoundingClientRect();
      setAnchor({
        top: rect.bottom + 8,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  const menuPanel = open && anchor ? (
    <>
      <div
        className="fixed inset-0 z-[1190] bg-slate-950/20"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      <div
        id="ac-account-menu-panel"
        role="menu"
        className="fixed z-[1200] w-60 rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] shadow-2xl shadow-black/40 overflow-hidden"
        style={{ top: anchor.top, right: anchor.right }}
      >
        <div className="px-3 py-3 border-b border-[var(--border-default)] bg-[var(--surface-secondary)]">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{displayName}</p>
          <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{user.email}</p>
        </div>

        {showMobileApp && onPwaSettings ? (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onPwaSettings();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <Smartphone className="w-4 h-4 text-teal-500 dark:text-teal-400" />
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
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
        >
          <Settings className="w-4 h-4 text-[var(--text-muted)]" />
          {t('Settings')}
        </button>

        <div className="px-3 py-2.5 border-t border-[var(--border-default)] bg-[var(--surface-secondary)]">
          <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
            <Globe className="w-3 h-3" />
            {t('Language')}
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as typeof language)}
            aria-label={t('Language')}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-primary)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-teal-500/50"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
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
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 dark:text-red-400 hover:bg-red-500/10 border-t border-[var(--border-default)] transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {t('Log out')}
        </button>
      </div>
    </>
  ) : null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('Account menu')}
        className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--surface-secondary)] pl-1 pr-2 py-1 hover:bg-[var(--surface-hover)] transition-colors"
      >
        <Avatar
          src={user.avatar}
          name={user.name}
          email={user.email}
          size={32}
          className="shrink-0"
        />
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {typeof document !== 'undefined' && menuPanel ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}
