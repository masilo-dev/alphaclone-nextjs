'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  ExternalLink,
  Menu,
  PanelRight,
  Share2,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { openBonniePopoutWindow, resolveBonnieDashboardRoute } from '@/lib/bonnie/bonnieWorkspace';
import { BONNIE_MODULE_HINTS, resolveBonnieModuleFromPath } from '@/lib/bonnie/bonnieToolCatalog';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { bonnieService, resolveBonnieNavIntent } from '@/services/bonnieService';
import type { BonniePendingApprovalResponse } from '@/services/bonnieService';
import { useBonnieApprovals } from '@/hooks/useBonnieApprovals';
import { useBonnieConversations } from '@/hooks/useBonnieConversations';
import { useBonnieGoals } from '@/hooks/useBonnieGoals';
import BonnieChatPanel from './BonnieChatPanel';
import BonnieSidebar from './workspace/BonnieSidebar';
import BonnieWelcome, { type BonnieSuggestion } from './workspace/BonnieWelcome';
import BonnieContextPanel, { type BonnieContextItem } from './workspace/BonnieContextPanel';

type BonnieFullViewProps = {
  variant?: 'default' | 'popout';
};

export default function BonnieFullView({ variant = 'default' }: BonnieFullViewProps) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const contextPath = searchParams.get('from') || pathname || '';
  const activeModule = resolveBonnieModuleFromPath(contextPath);
  const moduleHint = BONNIE_MODULE_HINTS[activeModule];
  const isPopout = variant === 'popout';
  const tenantId = currentTenant?.id;

  const { pendingCount, handleApproval, refresh: refreshApprovals } = useBonnieApprovals(tenantId);
  const {
    conversations,
    loading: conversationsLoading,
    refresh,
    createConversation,
    patchConversation,
    deleteConversation,
  } = useBonnieConversations(tenantId);
  const {
    goals,
    loading: goalsLoading,
    refresh: refreshGoals,
    chaseGoals,
    patchGoal,
    openCount: openGoalsCount,
  } = useBonnieGoals(tenantId);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [externalPrompt, setExternalPrompt] = useState<string | null>(null);
  const [goalsChasing, setGoalsChasing] = useState(false);
  const [contextItems, setContextItems] = useState<BonnieContextItem[]>([
    {
      id: 'perm-tenant',
      kind: 'permission',
      label: 'Tenant-scoped tools',
      detail: 'Bonnie only accesses records in this workspace',
    },
  ]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const suggestions: BonnieSuggestion[] = useMemo(
    () => [
      {
        id: 'recover-payments',
        title: 'Recover overdue payments',
        description: 'Identify overdue invoices, draft reminders, and chase collections.',
        prompt:
          'Recover overdue payments: identify overdue invoices, group customers, analyse payment history, prepare reminder drafts for my approval, update CRM, and schedule follow-ups.',
        icon: 'invoice',
      },
      {
        id: 'priorities',
        title: 'Own today’s business priorities',
        description: 'Plan and chase open deals, overdue tasks, and urgent follow-ups.',
        prompt:
          'Take ownership of today’s business priorities across CRM, tasks, and invoices. Create a goal, assign specialist agents, and keep chasing until complete.',
        icon: 'workflow',
      },
      {
        id: 'leads',
        title: 'Revive overdue leads',
        description: 'Find stale leads, draft outreach, and monitor replies.',
        prompt:
          'Revive overdue leads: find stale leads, draft personalised outreach for approval, update CRM, and monitor replies.',
        icon: 'crm',
      },
      {
        id: 'social',
        title: 'Plan this week’s social posts',
        description: 'Draft a LinkedIn/Facebook plan as approval-gated drafts.',
        prompt:
          'Prepare this week’s social posts for LinkedIn and Facebook as drafts and request approval before publishing.',
        icon: 'social',
      },
      {
        id: 'calendar',
        title: 'Prep upcoming meetings',
        description: 'Highlight meetings that need prep or follow-up.',
        prompt: 'Review upcoming calendar events and prepare agendas plus post-meeting follow-ups.',
        icon: 'calendar',
      },
      {
        id: 'risks',
        title: 'Watch business risks',
        description: 'Scan stalled deals, cash risk, SLA issues, and failed automations.',
        prompt:
          'Monitor the top business risks across deals, invoices, support, and automations. Open goals for anything above threshold.',
        icon: 'risk',
      },
    ],
    []
  );

  const mapInstructionResult = (res: {
    response: string;
    success: boolean;
    executionStatus?: 'executed' | 'queued_for_approval' | 'read_only_answer' | 'planning_failed' | 'provider_blocked';
    toolsExecuted?: Array<{
      tool: string;
      success: boolean;
      summary: string;
      approvalRequired?: boolean;
      approvalId?: string;
      riskClass?: string;
      preview?: { target?: string; draft?: string };
    }>;
    pendingApproval?: BonniePendingApprovalResponse | null;
  }) => ({
    text: res.response,
    tools: res.toolsExecuted,
    approval: res.pendingApproval || undefined,
    executionStatus: res.executionStatus,
  });

  const handleBonnieMessage = async (
    text: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ) => {
    if (!tenantId) return { text: 'Select a workspace first.', error: true };
    setShowWelcome(false);
    const nav = resolveBonnieNavIntent(text, user?.role);
    if (nav) {
      router.push(nav.route);
      return { text: `Opening ${nav.label} for you now.` };
    }
    const res = await bonnieService.sendInstruction(tenantId, text, history, {
      pathname: contextPath || undefined,
      moduleContext: activeModule,
    });
    if (res.success) {
      void refreshApprovals();
      void refresh();
      void refreshGoals();
      return mapInstructionResult(res);
    }
    return { text: res.response || 'Failed to process command.', error: true, executionStatus: res.executionStatus };
  };

  const handleBonnieStream = async (
    text: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    onToken: (token: string) => void,
    onPhase?: (phase: string, meta?: Record<string, unknown>) => void,
    signal?: AbortSignal
  ) => {
    if (!tenantId) return { text: 'Select a workspace first.', error: true };
    setShowWelcome(false);
    const res = await bonnieService.streamInstruction(tenantId, text, history, {
      pathname: contextPath || undefined,
      moduleContext: activeModule,
      onToken,
      onPhase: (phase, meta) => onPhase?.(phase, meta),
      signal,
    });
    if (res.success) {
      void refreshApprovals();
      void refresh();
      void refreshGoals();
      return mapInstructionResult(res);
    }
    return { text: res.response || 'Failed to process command.', error: true, executionStatus: res.executionStatus };
  };

  const handleResolveApproval = async (
    approvalId: string,
    status: 'approved' | 'rejected',
    editedArgs?: Record<string, unknown>
  ) => {
    const result = await handleApproval(approvalId, status, editedArgs);
    void refreshGoals();
    return {
      success: result.success,
      message: result.execution?.result?.summary || result.execution?.error,
      continuation: result.continuation || null,
    };
  };

  const handleNewChat = useCallback(async () => {
    try {
      const created = await createConversation('New conversation', activeModule);
      setActiveConversationId(created.id);
      setShowWelcome(true);
      setExternalPrompt(null);
    } catch (err: any) {
      toast.error(err?.message || 'Could not start a new chat');
    }
  }, [createConversation, activeModule]);

  const runChase = useCallback(() => {
    setGoalsChasing(true);
    void chaseGoals()
      .catch((err: any) => toast.error(err?.message || 'Goal chase failed'))
      .finally(() => setGoalsChasing(false));
  }, [chaseGoals]);

  const bonnieDashboardRoute = resolveBonnieDashboardRoute(pathname, user?.role);

  if (!tenantId) {
    return (
      <div className="flex h-[calc(100vh-140px)] items-center justify-center bg-slate-50 p-8 text-center dark:bg-slate-950">
        <div className="max-w-md space-y-3">
          <Sparkles className="mx-auto h-10 w-10 text-teal-600" />
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Select a workspace</h3>
          <p className="text-sm text-slate-500">
            Bonnie needs an active Alphaclone Systems workspace before it can plan or execute work.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 ${
        isPopout ? 'h-dvh' : 'h-[calc(100dvh-8.5rem)] min-h-[560px]'
      }`}
    >
      <BonnieSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        conversations={conversations}
        activeId={activeConversationId}
        loading={conversationsLoading}
        workspaceName={currentTenant?.name}
        userLabel={user?.email || undefined}
        pendingApprovals={pendingCount}
        onNewChat={() => void handleNewChat()}
        onSelect={(id) => {
          setActiveConversationId(id);
          setShowWelcome(false);
        }}
        onRename={(id, title) => void patchConversation(id, { title })}
        onPin={(id, pinned) => void patchConversation(id, { pinned })}
        onArchive={(id) => {
          const current = conversations.find((c) => c.id === id);
          void patchConversation(id, { archive: !current?.archived });
        }}
        onDelete={(id) =>
          void deleteConversation(id).then(() => {
            if (activeConversationId === id) {
              setActiveConversationId(null);
              setShowWelcome(true);
            }
          })
        }
        onSearch={(q) => void refresh({ q, includeArchived: true })}
        onOpenApprovals={() => router.push('/dashboard/bonnie/approvals')}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-4">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-900"
            aria-label="Open conversations"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold sm:text-base">
              {activeConversation?.title || 'Bonnie AI workspace'}
            </h1>
            <p className="truncate text-[11px] text-slate-500">
              {currentTenant?.name || 'Workspace'} · {moduleHint.label} · Agentic BOS
              {openGoalsCount > 0 ? ` · ${openGoalsCount} goals` : ''}
              {pendingCount > 0 ? ` · ${pendingCount} approvals` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {!isPopout && (
              <button
                type="button"
                onClick={() => openBonniePopoutWindow(pathname || undefined)}
                className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 sm:inline-flex dark:hover:bg-slate-900"
                aria-label="Pop out Bonnie"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
            {isPopout && (
              <Link
                href={bonnieDashboardRoute}
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                Open in app
              </Link>
            )}
            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
              aria-label="Share conversation"
              onClick={() => toast('Share links coming soon')}
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
              aria-label="Toggle context panel"
              onClick={() => setContextOpen((v) => !v)}
            >
              <PanelRight className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          {showWelcome && !activeConversationId ? (
            <BonnieWelcome
              workspaceName={currentTenant?.name}
              suggestions={suggestions}
              onSelect={(prompt) => {
                setShowWelcome(false);
                setExternalPrompt(prompt);
              }}
            />
          ) : (
            <div className="absolute inset-0 p-2 sm:p-3">
              <BonnieChatPanel
                workspaceMode
                streaming
                conversationId={activeConversationId}
                storageKey={tenantId ? `bonnie_chat_ws_${tenantId}` : undefined}
                externalPrompt={externalPrompt}
                onExternalPromptConsumed={() => setExternalPrompt(null)}
                placeholder="State a business objective… Use @customer @invoice @project · / for commands"
                introMessage="I'm Bonnie — your Alphaclone Systems Chief Operating Officer. State a business objective and I'll plan, coordinate specialist agents, request approval when needed, and keep chasing until the work is done."
                onSend={handleBonnieMessage}
                onStreamSend={handleBonnieStream}
                onResolveApproval={handleResolveApproval}
                tenantId={tenantId}
                pathname={contextPath || undefined}
                userRole={user?.role}
              />
            </div>
          )}
        </div>
      </section>

      <div className={`${contextOpen ? 'hidden lg:flex' : 'hidden'} h-full`}>
        <BonnieContextPanel
          open={contextOpen}
          onClose={() => setContextOpen(false)}
          items={contextItems}
          onRemove={(id) => setContextItems((prev) => prev.filter((item) => item.id !== id))}
          pendingApprovals={pendingCount}
          connectionStatus="connected"
          goals={goals}
          goalsLoading={goalsLoading}
          goalsChasing={goalsChasing}
          onChaseGoals={runChase}
          onCancelGoal={(id) => void patchGoal(id, { cancel: true })}
          onResumeGoal={(id) => void patchGoal(id, { resume: true })}
          onSelectGoal={(id) => {
            setContextItems((prev) => {
              if (prev.some((item) => item.id === `goal-${id}`)) return prev;
              const goal = goals.find((g) => g.id === id);
              if (!goal) return prev;
              return [
                {
                  id: `goal-${id}`,
                  kind: 'goal',
                  label: goal.title,
                  detail: `${goal.status} · ${Math.round(Number(goal.progress_pct) || 0)}%`,
                },
                ...prev,
              ];
            });
          }}
        />
      </div>

      {contextOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 max-h-[55vh] overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 lg:hidden">
          <BonnieContextPanel
            open
            onClose={() => setContextOpen(false)}
            items={contextItems}
            onRemove={(id) => setContextItems((prev) => prev.filter((item) => item.id !== id))}
            pendingApprovals={pendingCount}
            goals={goals}
            goalsLoading={goalsLoading}
            goalsChasing={goalsChasing}
            onChaseGoals={runChase}
            onCancelGoal={(id) => void patchGoal(id, { cancel: true })}
            onResumeGoal={(id) => void patchGoal(id, { resume: true })}
          />
        </div>
      )}
    </div>
  );
}
