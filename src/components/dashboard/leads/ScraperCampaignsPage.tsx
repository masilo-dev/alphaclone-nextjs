'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Flex,
  Grid,
  Heading,
  HStack,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react';
import { LayoutGrid, MessageSquare, Settings2 } from 'lucide-react';
import LeadFinderProspectsView from './LeadFinderProspectsView';
import LeadFinderChat from './LeadFinderChat';
import ScraperCampaignBuilder from './ScraperCampaignBuilder';
import CampaignRunDashboard from './CampaignRunDashboard';
import ScraperLeadsTable from './ScraperLeadsTable';
import LeadFinderSystemPanel from './LeadFinderSystemPanel';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';
import type { LeadFinderStats } from '@/lib/scraper/leadFinderStatsServer';

type Tab = 'prospects' | 'chat' | 'campaigns';

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub: string;
}) {
  return (
    <Box
      borderWidth="1px"
      borderColor="whiteAlpha.200"
      borderRadius="xl"
      bg="gray.900"
      px={4}
      py={3}
      position="relative"
      overflow="hidden"
      _before={{
        content: '""',
        position: 'absolute',
        inset: 0,
        bg: 'rgba(20,184,166,0.08)',
        pointerEvents: 'none',
      }}
    >
      <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" fontWeight="semibold">
        {label}
      </Text>
      <Text mt={1} fontSize="2xl" fontWeight="bold" color="white" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Text>
      <Text mt={0.5} fontSize="xs" color="gray.400" noOfLines={1}>
        {sub}
      </Text>
    </Box>
  );
}

export default function ScraperCampaignsPage() {
  const tenant = useCurrentTenantSafe();
  const [tab, setTab] = useState<Tab>('prospects');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<LeadFinderStats | null>(null);

  const loadStats = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const res = await fetch(`/api/scraper-campaigns/stats?tenantId=${encodeURIComponent(tenant.id)}`);
      const data = await res.json();
      if (res.ok) setStats(data.stats);
    } catch {
      // optional
    }
  }, [tenant?.id]);

  useEffect(() => {
    void loadStats();
  }, [loadStats, refreshKey]);

  const onActivity = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <Box
      className="ac-scroll-full ac-enterprise-module"
      h="full"
      minH={0}
      w="full"
      pb={{ base: 20, md: 6 }}
      bgGradient="linear(to-b, gray.950, gray.900)"
    >
      <VStack align="stretch" spacing={5} px={{ base: 4, md: 6 }} pt={{ base: 4, md: 6 }} h="full" minH={0}>
        <Flex align="start" justify="space-between" gap={4} wrap="wrap" flexShrink={0}>
          <VStack align="start" spacing={1} maxW="3xl">
            <HStack spacing={2}>
              <Heading size="lg" color="white" letterSpacing="-0.02em">
                Lead Finder
              </Heading>
              <Badge colorScheme="teal" variant="subtle" borderRadius="md">
                Apollo-grade · Free data
              </Badge>
            </HStack>
            <Text color="gray.400" fontSize="sm">
              Reach-based prospecting with live scrape, auto enrichment, decision makers, plus free aerial / building 3D / birds-eye views.
              Only contactable leads are returned.
            </Text>
          </VStack>

          <ButtonGroup size="sm" isAttached variant="outline">
            <Button
              leftIcon={<LayoutGrid size={16} />}
              onClick={() => setTab('prospects')}
              colorScheme={tab === 'prospects' ? 'teal' : 'gray'}
              variant={tab === 'prospects' ? 'solid' : 'outline'}
              borderColor="whiteAlpha.300"
            >
              Prospects
            </Button>
            <Button
              leftIcon={<MessageSquare size={16} />}
              onClick={() => setTab('chat')}
              colorScheme={tab === 'chat' ? 'teal' : 'gray'}
              variant={tab === 'chat' ? 'solid' : 'outline'}
              borderColor="whiteAlpha.300"
            >
              AI Assist
            </Button>
            <Button
              leftIcon={<Settings2 size={16} />}
              onClick={() => setTab('campaigns')}
              colorScheme={tab === 'campaigns' ? 'gray' : 'gray'}
              variant={tab === 'campaigns' ? 'solid' : 'outline'}
              borderColor="whiteAlpha.300"
              bg={tab === 'campaigns' ? 'whiteAlpha.200' : undefined}
              color="white"
            >
              Campaigns
            </Button>
          </ButtonGroup>
        </Flex>

        {stats && (
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} flexShrink={0}>
            <StatCard
              label="Discovered"
              value={stats.leads.total}
              sub={`${stats.campaigns.active} active campaigns`}
            />
            <StatCard
              label="With email"
              value={stats.leads.withEmail}
              sub={
                stats.leads.total
                  ? `${Math.round((stats.leads.withEmail / stats.leads.total) * 100)}% contactable`
                  : 'Run a search'
              }
            />
            <StatCard
              label="In CRM"
              value={stats.pipeline.crmSynced}
              sub={`${stats.pipeline.contacted} contacted`}
            />
            <StatCard
              label="With phone"
              value={stats.leads.withPhone}
              sub={
                stats.system.leadSearch === 'in-process'
                  ? 'Railway Playwright + OSM'
                  : 'External scraper'
              }
            />
          </SimpleGrid>
        )}

        {tab === 'prospects' && <LeadFinderProspectsView onActivity={onActivity} />}

        {tab === 'chat' && (
          <Grid templateColumns={{ base: '1fr', xl: 'minmax(0,1fr) minmax(280px,320px)' }} gap={4} flex={1} minH={0}>
            <LeadFinderChat onActivity={onActivity} />
            <Box display={{ base: 'none', xl: 'block' }} minH={0}>
              <LeadFinderSystemPanel />
            </Box>
          </Grid>
        )}

        {tab === 'campaigns' && (
          <VStack align="stretch" spacing={6}>
            <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
              <ScraperCampaignBuilder onCreated={onActivity} />
              <CampaignRunDashboard
                key={refreshKey}
                selectedCampaignId={selectedCampaignId}
                onSelectCampaign={setSelectedCampaignId}
              />
            </Grid>
            <Grid templateColumns={{ base: '1fr', xl: '1fr 340px' }} gap={6}>
              <ScraperLeadsTable campaignId={selectedCampaignId} showAllWhenNoCampaign />
              <LeadFinderSystemPanel compact />
            </Grid>
          </VStack>
        )}

      </VStack>
    </Box>
  );
}
