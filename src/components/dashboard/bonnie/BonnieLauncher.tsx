'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Brain, ExternalLink, Sun } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBonnieApprovals } from '@/hooks/useBonnieApprovals';
import { useBonnieMorningBrief } from '@/hooks/useBonnieMorningBrief';
import {
  openBonniePopoutWindow,
  resolveBonnieDashboardRoute,
} from '@/lib/bonnie/bonnieWorkspace';

/**
 * Lightweight global entry to Bonnie — opens the dedicated workspace module or a pop-out window.
 * Does not embed a chat drawer on every page (that crowded module layouts).
 */
export default function BonnieLauncher() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
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
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+78px)] right-3 z-[70] flex flex-col items-end md:bottom-5 md:right-5"
      data-tour="bonnie-widget"
    >
      {menuOpen && (
        <div className="mb-2 w-56 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            onClick={openWorkspace}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            <Brain className="h-4 w-4 text-teal-400" />
            Open Bonnie workspace
          </button>
          <button
            type="button"
            onClick={openPopout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
          >
            <ExternalLink className="h-4 w-4 text-cyan-400" />
            Pop out window
          </button>
          {pendingCount > 0 && (
            <p className="px-3 py-1.5 text-[11px] text-amber-400">
              {pendingCount} approval{pendingCount === 1 ? '' : 's'} waiting
            </p>
          )}
        </div>
      )}

      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setMenuOpen((open) => !open)}
        title="Bonnie AI workspace"
        aria-label="Open Bonnie AI workspace"
        aria-expanded={menuOpen}
        className="relative flex h-14 min-w-[3.5rem] items-center justify-center gap-1.5 rounded-full bg-gradient-to-br from-teal-500 via-cyan-500 to-indigo-600 px-4 text-white shadow-xl shadow-teal-500/20 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900 border border-teal-400/20"
      >
        <Brain className="h-6 w-6 shrink-0" />
        <span className="hidden sm:inline text-xs font-black uppercase tracking-wide">Bonnie</span>
        {hasUnreadBrief && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-300 text-slate-950 shadow-lg">
            <Sun className="h-3 w-3" />
          </span>
        )}
        {pendingCount > 0 && (
          <span className="absolute -top-1 -left-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950">
            {pendingCount}
          </span>
        )}
      </motion.button>
    </div>
  );
}
