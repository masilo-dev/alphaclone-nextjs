'use client';

import React from 'react';
import { ExternalLink, LayoutPanelLeft } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBonnieApprovals } from '@/hooks/useBonnieApprovals';
import { useBonnieMorningBrief } from '@/hooks/useBonnieMorningBrief';
import { useBonnieDrawerOptional } from '@/contexts/BonnieDrawerContext';
import {
  openBonniePopoutWindow,
  resolveBonnieDashboardRoute,
} from '@/lib/bonnie/bonnieWorkspace';
import { IconBonnie } from '@/components/icons/alphaclone';
import { cn } from '@/lib/utils';

/**
 * Global Bonnie entry — violet brand FAB.
 * Opens the contextual drawer by default; full workspace remains available.
 */
export default function BonnieLauncher() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const drawer = useBonnieDrawerOptional();
  const tenantId = currentTenant?.id;
  const { pendingCount } = useBonnieApprovals(tenantId);
  const { brief: morningBrief } = useBonnieMorningBrief(tenantId);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const hasUnreadBrief = Boolean(morningBrief?.summary && morningBrief.read !== true);
  const bonnieRoute = resolveBonnieDashboardRoute(pathname, user?.role);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  if (!tenantId) return null;

  const openDrawer = () => {
    setMenuOpen(false);
    if (drawer) {
      drawer.openDrawer({ mode: 'ask' });
      return;
    }
    router.push(bonnieRoute);
  };

  const openWorkspace = () => {
    setMenuOpen(false);
    router.push(bonnieRoute);
  };

  const openPopout = () => {
    setMenuOpen(false);
    openBonniePopoutWindow(pathname || undefined);
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[70] flex flex-col items-end right-3 md:right-5 bottom-[calc(env(safe-area-inset-bottom,0px)+78px)] md:bottom-5"
      data-tour="bonnie-widget"
    >
      {menuOpen ? (
        <div className="mb-2 w-56 rounded-[14px] border border-[var(--ws-border)] bg-[var(--ws-surface-primary)] p-1.5 shadow-[var(--ws-card-shadow-hover)]">
          <button
            type="button"
            onClick={openDrawer}
            className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-sm font-medium text-[var(--ws-text-primary)] hover:bg-[var(--ws-hover)]"
          >
            <IconBonnie size={16} variant="duotone" className="text-[var(--brand-violet-500)]" decorative />
            Ask Bonnie
          </button>
          <button
            type="button"
            onClick={openWorkspace}
            className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-sm font-medium text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)]"
          >
            <LayoutPanelLeft className="w-4 h-4 text-[var(--ws-text-muted)]" />
            Open full workspace
          </button>
          <button
            type="button"
            onClick={openPopout}
            className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-sm font-medium text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)]"
          >
            <ExternalLink className="w-4 h-4 text-[var(--ws-text-muted)]" />
            Pop out window
          </button>
          {pendingCount > 0 ? (
            <p className="px-3 py-1.5 text-[11px] text-[var(--warning-text)]">
              {pendingCount} approval{pendingCount === 1 ? '' : 's'} waiting
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="relative">
        <button
          type="button"
          aria-label="Open Bonnie AI"
          aria-expanded={menuOpen}
          title="Bonnie AI"
          onClick={() => setMenuOpen((open) => !open)}
          className={cn(
            'inline-flex h-14 min-w-14 items-center justify-center gap-1.5 rounded-[12px] px-0 sm:px-4',
            'bg-[var(--brand-violet-500)] text-white border border-[var(--brand-violet-400)]',
            'shadow-md hover:bg-[var(--brand-violet-600)] active:bg-[var(--brand-violet-700)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-violet-300)]'
          )}
        >
          <IconBonnie size={22} variant="filled" decorative />
          <span className="hidden sm:inline text-xs font-bold uppercase tracking-wide">Bonnie</span>
        </button>
        {hasUnreadBrief ? (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-md bg-[var(--brand-violet-300)] text-[var(--brand-violet-950)] text-[10px] font-bold px-1">
            •
          </span>
        ) : null}
        {pendingCount > 0 ? (
          <span className="absolute -top-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-md bg-[var(--warning-500)] text-[var(--dark-app-background,#0C1220)] text-[10px] font-bold px-1">
            {pendingCount}
          </span>
        ) : null}
      </div>
    </div>
  );
}
