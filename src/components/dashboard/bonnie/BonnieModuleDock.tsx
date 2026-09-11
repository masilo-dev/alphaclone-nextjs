'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Brain, ChevronLeft, ChevronRight } from 'lucide-react';
import BonnieChatPanel from './BonnieChatPanel';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { bonnieService, resolveBonnieNavIntent } from '@/services/bonnieService';
import { BONNIE_MODULE_HINTS, resolveBonnieModuleFromPath } from '@/lib/bonnie/bonnieToolCatalog';
import { useBonnieApprovals } from '@/hooks/useBonnieApprovals';

export default function BonnieModuleDock() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const tenantId = currentTenant?.id;
  const activeModule = resolveBonnieModuleFromPath(pathname || '');
  const moduleHint = BONNIE_MODULE_HINTS[activeModule];
  const { pendingCount, handleApproval, refresh: refreshApprovals } = useBonnieApprovals(tenantId);
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const hasLoadedPreferenceRef = React.useRef(false);

  React.useEffect(() => {
    if (!tenantId || typeof window === 'undefined') return;
    const storageKey = `bonnie_module_dock_collapsed_${tenantId}`;
    const saved = window.localStorage.getItem(storageKey);
    if (saved != null) {
      setIsCollapsed(saved === 'true');
    }
    hasLoadedPreferenceRef.current = true;
  }, [tenantId]);

  React.useEffect(() => {
    if (!tenantId || typeof window === 'undefined' || !hasLoadedPreferenceRef.current) return;
    const storageKey = `bonnie_module_dock_collapsed_${tenantId}`;
    window.localStorage.setItem(storageKey, String(isCollapsed));
  }, [isCollapsed, tenantId]);

  if (!tenantId) return null;

  const mapResult = (res: Awaited<ReturnType<typeof bonnieService.sendInstruction>>) => ({
    text: res.response,
    tools: res.toolsExecuted,
    approval: res.pendingApproval || undefined,
    executionStatus: res.executionStatus,
  });

  const handleSend = async (
    text: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ) => {
    const nav = resolveBonnieNavIntent(text, user?.role);
    if (nav) {
      router.push(nav.route);
      return { text: `Opening ${nav.label} for you now.` };
    }

    const res = await bonnieService.sendInstruction(tenantId, text, history, {
      pathname: pathname || undefined,
      moduleContext: activeModule,
    });
    void refreshApprovals();
    if (res.success) return mapResult(res);
    return { text: res.response || 'Failed to process command.', error: true, executionStatus: res.executionStatus };
  };

  const handleStream = async (
    text: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    onToken: (token: string) => void,
    onPhase?: (phase: string) => void
  ) => {
    const res = await bonnieService.streamInstruction(tenantId, text, history, {
      pathname: pathname || undefined,
      moduleContext: activeModule,
      onToken,
      onPhase,
    });
    void refreshApprovals();
    if (res.success) return mapResult(res);
    return { text: res.response || 'Failed to process command.', error: true, executionStatus: res.executionStatus };
  };

  const handleResolveApproval = async (
    approvalId: string,
    status: 'approved' | 'rejected',
    editedArgs?: Record<string, unknown>
  ) => {
    const result = await handleApproval(approvalId, status, editedArgs);
    return {
      success: result.success,
      message: result.execution?.result?.summary || result.execution?.error,
    };
  };

  return (
    <div className="flex h-full min-h-[360px] max-h-[calc(100dvh-12rem)] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#090d16]">
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2.5">
        <Brain className="h-4 w-4 text-teal-400" />
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-teal-300">Bonnie AI</p>
            <p className="truncate text-[10px] text-slate-500">{moduleHint.label}</p>
          </div>
        )}
        {pendingCount > 0 && !isCollapsed && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950">
            {pendingCount}
          </span>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition-colors hover:border-teal-500/30 hover:text-white"
          aria-label={isCollapsed ? 'Open Bonnie drawer' : 'Collapse Bonnie drawer'}
        >
          {isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
      {isCollapsed ? (
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="flex flex-1 items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-950/50"
        >
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">Bonnie drawer collapsed</p>
            <p className="text-xs text-slate-500">Open it when you want help, without giving up as much workspace width.</p>
          </div>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-slate-950">
              {pendingCount} pending
            </span>
          )}
        </button>
      ) : (
        <div className="flex-1 min-h-0 p-2">
          <BonnieChatPanel
            streaming
            storageKey={`bonnie_dock_${tenantId}_${activeModule}`}
            placeholder={`Ask about ${moduleHint.label.toLowerCase()}...`}
            introMessage={`Context: ${moduleHint.label}. Try "${moduleHint.examples[0]}"`}
            onSend={handleSend}
            onStreamSend={handleStream}
            onResolveApproval={handleResolveApproval}
          />
        </div>
      )}
    </div>
  );
}
