'use client';

import React from 'react';
import {
  Badge,
  Box,
  Button,
  HStack,
  IconButton,
  Text,
  VStack,
} from '@chakra-ui/react';
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
import { BONNIE_CHAKRA } from './bonnieChakra';

/**
 * Global Bonnie entry — solid teal enterprise FAB (no indigo/glow gradient).
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
    <Box
      ref={menuRef}
      position="fixed"
      bottom={{ base: 'calc(env(safe-area-inset-bottom, 0px) + 78px)', md: 5 }}
      right={{ base: 3, md: 5 }}
      zIndex={70}
      display="flex"
      flexDirection="column"
      alignItems="flex-end"
      data-tour="bonnie-widget"
    >
      {menuOpen && (
        <VStack
          align="stretch"
          spacing={1}
          mb={2}
          w="56"
          p={1.5}
          {...BONNIE_CHAKRA.panelProps}
          bg="gray.950"
          boxShadow="md"
        >
          <Button
            variant="ghost"
            justifyContent="flex-start"
            h="auto"
            py={2.5}
            px={3}
            color="white"
            fontWeight="medium"
            fontSize="sm"
            leftIcon={<Brain size={16} color="#2DD4BF" />}
            onClick={openWorkspace}
            _hover={{ bg: 'whiteAlpha.100' }}
          >
            Open Bonnie workspace
          </Button>
          <Button
            variant="ghost"
            justifyContent="flex-start"
            h="auto"
            py={2.5}
            px={3}
            color="gray.300"
            fontWeight="medium"
            fontSize="sm"
            leftIcon={<ExternalLink size={16} color="#94A3B8" />}
            onClick={openPopout}
            _hover={{ bg: 'whiteAlpha.100' }}
          >
            Pop out window
          </Button>
          {pendingCount > 0 && (
            <Text px={3} py={1.5} fontSize="11px" color="amber.400">
              {pendingCount} approval{pendingCount === 1 ? '' : 's'} waiting
            </Text>
          )}
        </VStack>
      )}

      <Box position="relative">
        <IconButton
          aria-label="Open Bonnie AI workspace"
          aria-expanded={menuOpen}
          title="Bonnie AI workspace"
          onClick={() => setMenuOpen((open) => !open)}
          icon={
            <HStack spacing={1.5}>
              <Brain size={22} />
              <Text display={{ base: 'none', sm: 'inline' }} fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wide">
                Bonnie
              </Text>
            </HStack>
          }
          h="14"
          minW="14"
          px={{ base: 0, sm: 4 }}
          borderRadius="lg"
          bg="teal.600"
          color="white"
          borderWidth="1px"
          borderColor="teal.500"
          boxShadow="md"
          _hover={{ bg: 'teal.500' }}
          _active={{ bg: 'teal.700' }}
          _focusVisible={{ boxShadow: '0 0 0 2px var(--chakra-colors-teal-400)' }}
        />
        {hasUnreadBrief && (
          <Badge
            position="absolute"
            top={-1}
            right={-1}
            borderRadius="md"
            bg="teal.300"
            color="gray.950"
            p={0}
            minW={5}
            h={5}
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Sun size={12} />
          </Badge>
        )}
        {pendingCount > 0 && (
          <Badge
            position="absolute"
            top={-1}
            left={-1}
            borderRadius="md"
            bg="amber.500"
            color="gray.950"
            fontSize="10px"
            fontWeight="bold"
            minW={5}
            h={5}
            display="flex"
            alignItems="center"
            justifyContent="center"
            px={1}
          >
            {pendingCount}
          </Badge>
        )}
      </Box>
    </Box>
  );
}
