'use client';

import React from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useRouter, usePathname } from 'next/navigation';
import { Brain, ChevronLeft, ChevronRight } from 'lucide-react';
import BonnieChatPanel from './BonnieChatPanel';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { bonnieService, resolveBonnieNavIntent } from '@/services/bonnieService';
import { BONNIE_MODULE_HINTS, resolveBonnieModuleFromPath } from '@/lib/bonnie/bonnieToolCatalog';
import { useBonnieApprovals } from '@/hooks/useBonnieApprovals';
import { BC } from './bonnieChakra';

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
    onPhase?: (phase: string, meta?: Record<string, unknown>) => void
  ) => {
    const res = await bonnieService.streamInstruction(tenantId, text, history, {
      pathname: pathname || undefined,
      moduleContext: activeModule,
      onToken,
      onPhase: (phase, meta) => onPhase?.(phase, meta),
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
      continuation: result.continuation || null,
    };
  };

  return (
    <Flex
      h="full"
      minH="360px"
      maxH="calc(100dvh - 12rem)"
      direction="column"
      overflow="hidden"
      borderWidth="1px"
      borderColor={BC.border}
      borderRadius={BC.radius}
      bg={BC.bg}
    >
      <Flex align="center" gap={2} borderBottomWidth="1px" borderColor={BC.border} px={3} py={2.5}>
        <Brain size={16} color="#2DD4BF" />
        {!isCollapsed && (
          <Box minW={0} flex={1}>
            <Text fontSize="xs" fontWeight="bold" color="teal.300">
              Bonnie AI
            </Text>
            <Text fontSize="10px" color={BC.subtle} noOfLines={1}>
              {moduleHint.label}
            </Text>
          </Box>
        )}
        {pendingCount > 0 && !isCollapsed && (
          <Box
            as="span"
            borderRadius="md"
            bg="amber.500"
            px={2}
            py={0.5}
            fontSize="10px"
            fontWeight="bold"
            color="gray.950"
          >
            {pendingCount}
          </Box>
        )}
        <IconButton
          type="button"
          aria-label={isCollapsed ? 'Open Bonnie drawer' : 'Collapse Bonnie drawer'}
          onClick={() => setIsCollapsed((prev) => !prev)}
          ml="auto"
          size="sm"
          variant="outline"
          borderColor="gray.700"
          bg="gray.900"
          color="gray.300"
          borderRadius={BC.controlRadius}
          icon={isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          _hover={{ borderColor: 'teal.500', color: 'white' }}
        />
      </Flex>

      {isCollapsed ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setIsCollapsed(false)}
          flex={1}
          h="auto"
          borderRadius={0}
          justifyContent="space-between"
          alignItems="flex-start"
          textAlign="left"
          whiteSpace="normal"
          px={4}
          py={4}
          _hover={{ bg: 'whiteAlpha.50' }}
        >
          <VStack align="start" spacing={1} minW={0}>
            <Heading size="xs" color="white" fontWeight="semibold">
              Bonnie drawer collapsed
            </Heading>
            <Text fontSize="xs" color={BC.subtle} fontWeight="normal">
              Open it when you want help, without giving up as much workspace width.
            </Text>
          </VStack>
          {pendingCount > 0 && (
            <Box
              as="span"
              borderRadius="md"
              bg="amber.500"
              px={2.5}
              py={1}
              fontSize="10px"
              fontWeight="bold"
              color="gray.950"
              flexShrink={0}
            >
              {pendingCount} pending
            </Box>
          )}
        </Button>
      ) : (
        <Box flex={1} minH={0} p={2}>
          <BonnieChatPanel
            streaming
            storageKey={`bonnie_dock_${tenantId}_${activeModule}`}
            placeholder={`Ask about ${moduleHint.label.toLowerCase()}...`}
            introMessage={`Context: ${moduleHint.label}. Try "${moduleHint.examples[0]}"`}
            onSend={handleSend}
            onStreamSend={handleStream}
            onResolveApproval={handleResolveApproval}
            tenantId={tenantId}
            pathname={pathname || undefined}
            userRole={user?.role}
          />
        </Box>
      )}
    </Flex>
  );
}
