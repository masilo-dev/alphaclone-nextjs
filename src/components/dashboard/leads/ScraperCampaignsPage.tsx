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
      borderRadius="lg"
      bg="gray.900"
      px={3}
      py={2}
      position="relative"
      overflow="hidden"
    >
      <Text fontSize="10px" color="gray.500" textTransform="uppercase" letterSpacing="wide" fontWeight="semibold">
        {label}
      </Text>
      <Text mt={0.5} fontSize="xl" fontWeight="bold" color="white" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Text>
      <Text fontSize="10px" color="gray.500" noOfLines={1}>
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
      className="ac-enterprise-module"
      minH={0}
      w="full"
      pb={{ base: 24, md: 10 }}
      bgGradient="linear(to-b, gray.950, gray.900)"
    >
      <VStack align="stretch" spacing={3} px={{ base: 3, md: 5 }} pt={{ base: 3, md: 4 }} minH={0}>
        <Flex align="center" justify="space-between" gap={3} wrap="wrap" flexShrink={0}>
          <VStack align="start" spacing={0} maxW="2xl" minW={0}>
            <HStack spacing={2} flexWrap="wrap">
              <Heading size="md" color="white" letterSpacing="-0.02em">
                Lead Finder
              </Heading>
              <Badge colorScheme="teal" variant="subtle" borderRadius="md" fontSize="10px">
                Free data · contact required
              </Badge>
            </HStack>
            <Text color="gray.500" fontSize="xs" noOfLines={1}>
              Reach-based scrape · auto enrich · aerial map — phone or email on every lead
            </Text>
          </VStack>

          <ButtonGroup size="sm" isAttached variant="outline">
            <Button
              leftIcon={<LayoutGrid size={15} />}
              onClick={() => setTab('prospects')}
              colorScheme={tab === 'prospects' ? 'teal' : 'gray'}
              variant={tab === 'prospects' ? 'solid' : 'outline'}
              borderColor="whiteAlpha.300"
            >
              Prospects
            </Button>
            <Button
              leftIcon={<MessageSquare size={15} />}
              onClick={() => setTab('chat')}
              colorScheme={tab === 'chat' ? 'teal' : 'gray'}
              variant={tab === 'chat' ? 'solid' : 'outline'}
              borderColor="whiteAlpha.300"
            >
              AI Assist
            </Button>
            <Button
              leftIcon={<Settings2 size={15} />}
              onClick={() => setTab('campaigns')}
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
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={2} flexShrink={0}>
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
