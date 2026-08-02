'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Flex,
  Heading,
  HStack,
  IconButton,
  Link as ChakraLink,
  Text,
  VStack,
} from '@chakra-ui/react';
import {
  Brain,
  ExternalLink,
  Menu,
  PanelRight,
  Share2,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { openBonniePopoutWindow, resolveBonnieDashboardRoute } from '@/lib/bonnie/bonnieWorkspace';
import { BONNIE_MODULE_HINTS, resolveBonnieModuleFromPath } from '@/lib/bonnie/bonnieToolCatalog';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { bonnieService } from '@/services/bonnieService';
import type { BonniePendingApprovalResponse } from '@/services/bonnieService';
import { useBonnieApprovals } from '@/hooks/useBonnieApprovals';
import { useBonnieConversations } from '@/hooks/useBonnieConversations';
import { useBonnieGoals } from '@/hooks/useBonnieGoals';
import BonnieChatPanel from './BonnieChatPanel';
import BonnieSidebar from './workspace/BonnieSidebar';
import BonnieWelcome, { type BonnieSuggestion } from './workspace/BonnieWelcome';
import BonnieContextPanel, { type BonnieContextItem } from './workspace/BonnieContextPanel';
import BonnieWorkspaceViews, {
  type BonnieWorkspaceView,
} from './workspace/BonnieWorkspaceViews';
import { BC } from './bonnieChakra';

type BonnieFullViewProps = {
  variant?: 'default' | 'popout';
};

export default function BonnieFullView({ variant = 'default' }: BonnieFullViewProps) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resolvedPathname = pathname || resolveBonnieDashboardRoute(pathname, user?.role);
  const contextPath = searchParams?.get('from') || resolvedPathname || '';
  const activeModule = resolveBonnieModuleFromPath(contextPath);
  const moduleHint = BONNIE_MODULE_HINTS[activeModule];
  const isPopout = variant === 'popout';
  const tenantId = currentTenant?.id;
  const conversationParam = searchParams?.get('conversation') ?? null;
  const queuedPrompt = searchParams?.get('q')?.trim() || null;

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
  const [workspaceView, setWorkspaceView] = useState<BonnieWorkspaceView>('chat');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!conversationParam) return;
    if (activeConversationId) return;
    const exists = conversations.some((c) => c.id === conversationParam);
    if (exists) {
      setActiveConversationId(conversationParam);
      setShowWelcome(false);
    }
  }, [activeConversationId, conversationParam, conversations]);

  // Prompts launched from the global Bonnie drawer must enter the real agent
  // loop automatically. Consume the URL once so refresh/back cannot rerun work.
  useEffect(() => {
    if (!queuedPrompt || !tenantId) return;
    setShowWelcome(false);
    setWorkspaceView('chat');
    setExternalPrompt(queuedPrompt);
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    next.delete('q');
    next.delete('mode');
    next.delete('context');
    const qs = next.toString();
    router.replace(qs ? `${resolvedPathname}?${qs}` : resolvedPathname);
  }, [queuedPrompt, resolvedPathname, router, searchParams, tenantId]);

  const replaceConversationParam = useCallback(
    (nextConversationId: string | null) => {
      const next = new URLSearchParams(searchParams?.toString() ?? '');
      if (nextConversationId) next.set('conversation', nextConversationId);
      else next.delete('conversation');
      const qs = next.toString();
      router.replace(qs ? `${resolvedPathname}?${qs}` : resolvedPathname);
    },
    [resolvedPathname, router, searchParams]
  );

  const suggestions: BonnieSuggestion[] = useMemo(
    () => [
      {
        id: 'recover-payments',
        title: 'Chase overdue invoices',
        description: 'Find overdue invoices and send payment reminders now.',
        prompt:
          'Chase overdue invoices now: pull AR aging, group by customer, send payment reminders with nexus_invoice_chasing / send_invoice, update CRM notes, and report what was sent.',
        icon: 'invoice',
      },
      {
        id: 'find-leads',
        title: 'Find and qualify leads',
        description: 'Run Lead Finder / scraper discovery and return ranked prospects.',
        prompt:
          'Find leads for my ideal customer profile: run find_and_qualify_leads (or create_scraper_campaign + run_scraper_campaign), score them, save hot leads to CRM, and list the top results with next outreach steps.',
        icon: 'crm',
      },
      {
        id: 'outreach',
        title: 'Send outreach now',
        description: 'Personalise and send outreach to hot leads.',
        prompt:
          'Send outreach now: pull hot/scraper leads, generate personalised messages, send via email or batch outreach, and log activity in CRM.',
        icon: 'workflow',
      },
      {
        id: 'social',
        title: 'Publish social posts',
        description: 'Create and publish Facebook/LinkedIn posts immediately.',
        prompt:
          'Publish social posts now for LinkedIn and Facebook: write captions, create the posts with the social tools, publish them, and confirm live status. Do not stop at drafts.',
        icon: 'social',
      },
      {
        id: 'priorities',
        title: 'Own today’s priorities',
        description: 'Execute across deals, tasks, and collections until done.',
        prompt:
          'Take ownership of today’s business priorities across CRM, tasks, and invoices. Create a goal with executeActions, assign specialist agents, execute tools, and keep chasing until complete.',
        icon: 'workflow',
      },
      {
        id: 'accounting',
        title: 'Accounting snapshot + act',
        description: 'Review money modules then fix overdue cash risk.',
        prompt:
          'Run accounting_snapshot and get_accounts_receivable_aging, then chase the highest-risk overdue invoices and report what you executed.',
        icon: 'invoice',
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
      replaceConversationParam(created.id);
      setShowWelcome(true);
      setExternalPrompt(null);
    } catch (err: any) {
      toast.error(err?.message || 'Could not start a new chat');
    }
  }, [createConversation, activeModule, replaceConversationParam]);

  const runChase = useCallback(() => {
    setGoalsChasing(true);
    void chaseGoals()
      .catch((err: any) => toast.error(err?.message || 'Goal chase failed'))
      .finally(() => setGoalsChasing(false));
  }, [chaseGoals]);

  const bonnieDashboardRoute = resolveBonnieDashboardRoute(pathname, user?.role);

  if (!tenantId) {
    return (
      <Flex h="calc(100vh - 140px)" align="center" justify="center" bg="gray.950" p={8} textAlign="center">
        <VStack spacing={3} maxW="md">
          <Brain size={36} color="#0D9488" />
          <Heading size="md" color="white">
            Select a workspace
          </Heading>
          <Text fontSize="sm" color="gray.400">
            Bonnie needs an active Alphaclone Systems workspace before it can plan or execute work.
          </Text>
        </VStack>
      </Flex>
    );
  }

  return (
    <Flex
      overflow="hidden"
      borderWidth="1px"
      borderColor="whiteAlpha.200"
      borderRadius={BC.radii.panel}
      bg="gray.950"
      color="whiteAlpha.900"
      h={isPopout ? '100dvh' : 'calc(100dvh - 8.5rem)'}
      minH="560px"
      className="ac-enterprise-module"
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
          replaceConversationParam(id);
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
              replaceConversationParam(null);
              setShowWelcome(true);
            }
          })
        }
        onSearch={(q) => void refresh({ q, includeArchived: true })}
        onOpenApprovals={() => router.push('/dashboard/bonnie/approvals')}
      />

      <Flex direction="column" minW={0} flex={1}>
        <Flex {...BC.toolbarProps} gap={3}>
          <IconButton
            aria-label="Open conversations"
            display={{ base: 'inline-flex', md: 'none' }}
            variant="ghost"
            color="gray.400"
            icon={<Menu size={20} />}
            onClick={() => setMobileSidebarOpen(true)}
            borderRadius="md"
            minW={11}
            minH={11}
          />
          <Box minW={0} flex={1}>
            <Heading size="xs" color="white" noOfLines={1} fontWeight="semibold">
              {activeConversation?.title || 'Bonnie workspace'}
            </Heading>
            <Text fontSize="10px" color="gray.500" noOfLines={1}>
              {currentTenant?.name || 'Workspace'} · {moduleHint.label} · Executes tools
              {openGoalsCount > 0 ? ` · ${openGoalsCount} goals` : ''}
              {pendingCount > 0 ? ` · ${pendingCount} approvals` : ''}
            </Text>
          </Box>
          <HStack spacing={1}>
            {!isPopout && (
              <IconButton
                aria-label="Pop out Bonnie"
                display={{ base: 'none', sm: 'inline-flex' }}
                variant="ghost"
                color="gray.400"
                icon={<ExternalLink size={16} />}
                onClick={() => openBonniePopoutWindow(pathname || undefined)}
                borderRadius="md"
                minW={11}
                minH={11}
              />
            )}
            {isPopout && (
              <ChakraLink
                as={Link}
                href={bonnieDashboardRoute}
                fontSize="xs"
                fontWeight="medium"
                color="gray.300"
                px={2}
                py={1.5}
                borderRadius="md"
                _hover={{ bg: 'whiteAlpha.100', textDecoration: 'none' }}
              >
                Open in app
              </ChakraLink>
            )}
            <IconButton
              aria-label="Share conversation"
              variant="ghost"
              color="gray.400"
              icon={<Share2 size={16} />}
              onClick={async () => {
                if (!activeConversationId) {
                  toast.error('Select a conversation to share');
                  return;
                }
                const next = new URLSearchParams(searchParams?.toString() ?? '');
                next.set('conversation', activeConversationId);
                const shareUrl = `${window.location.origin}${resolvedPathname}?${next.toString()}`;
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  toast.success('Share link copied');
                } catch {
                  window.prompt('Copy share link', shareUrl);
                }
              }}
              borderRadius="md"
              minW={11}
              minH={11}
            />
            <IconButton
              aria-label="Toggle context panel"
              variant="ghost"
              color="gray.400"
              icon={<PanelRight size={16} />}
              onClick={() => setContextOpen((v) => !v)}
              borderRadius="md"
              minW={11}
              minH={11}
            />
          </HStack>
        </Flex>

        <Box position="relative" minH={0} flex={1}>
          <BonnieWorkspaceViews
            tenantId={tenantId}
            view={workspaceView}
            onChangeView={(v) => {
              setWorkspaceView(v);
              if (v !== 'chat') setShowWelcome(false);
            }}
            selectedRunId={selectedRunId}
            onSelectRun={setSelectedRunId}
            chatSlot={
              showWelcome && !activeConversationId ? (
                <BonnieWelcome
                  workspaceName={currentTenant?.name}
                  suggestions={suggestions}
                  onSelect={(prompt) => {
                    setShowWelcome(false);
                    setExternalPrompt(prompt);
                  }}
                />
              ) : (
                <Box position="absolute" inset={0} p={{ base: 2, sm: 3 }}>
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
                </Box>
              )
            }
          />
        </Box>
      </Flex>

      <Flex display={{ base: 'none', lg: contextOpen ? 'flex' : 'none' }} h="full">
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
          tenantId={tenantId}
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
      </Flex>

      {contextOpen && (
        <Box
          display={{ base: 'block', lg: 'none' }}
          position="fixed"
          insetX={0}
          bottom={0}
          zIndex={30}
          maxH="55vh"
          overflow="hidden"
          borderTopRadius="lg"
          borderWidth="1px"
          borderColor="whiteAlpha.200"
          bg="gray.950"
          boxShadow="md"
        >
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
            tenantId={tenantId}
          />
        </Box>
      )}
    </Flex>
  );
}
