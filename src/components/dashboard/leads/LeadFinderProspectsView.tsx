'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Loader2, MapPin, Radar, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';
import type { LeadFinderProfile } from '@/lib/scraper/leadFinderLearning';
import type { ParsedLeadIntent } from '@/lib/scraper/parseLeadIntent';
import ScraperLeadsTable, { type ScraperLead } from './ScraperLeadsTable';
import LeadFinderSystemPanel from './LeadFinderSystemPanel';
import LeadFinderSmartBar from './LeadFinderSmartBar';
import LeadFinderBeginnerGuide from './LeadFinderBeginnerGuide';
import LeadFinderLiveProgress from './LeadFinderLiveProgress';
import LeadFinderMapPanel from './LeadFinderMapPanel';
import LeadFinderAerialStudio, { type AerialLead } from './LeadFinderAerialStudio';

type Props = {
  onActivity?: () => void;
};

const RADIUS_OPTIONS = [5, 10, 15, 25, 40, 60];

export default function LeadFinderProspectsView({ onActivity }: Props) {
  const tenant = useCurrentTenantSafe();
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [radiusKm, setRadiusKm] = useState(25);
  const [hasEmail, setHasEmail] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [mapLeads, setMapLeads] = useState<ScraperLead[]>([]);
  const [focusedLeadId, setFocusedLeadId] = useState<string | null>(null);

  const mapPins = useMemo(
    () =>
      mapLeads.map((l) => ({
        business_name: l.company || l.name || 'Lead',
        address: l.address,
        phone: l.phone,
        website: l.company_website || l.source_url,
        category: l.industry,
        source: l.source,
        lat: l.lat ?? undefined,
        lng: l.lng ?? undefined,
      })),
    [mapLeads]
  );

  const aerialLeads: AerialLead[] = useMemo(
    () =>
      mapLeads
        .filter((l) => l.lat != null && l.lng != null)
        .map((l) => ({
          id: l.id,
          business_name: l.company || l.name || 'Lead',
          lat: l.lat ?? undefined,
          lng: l.lng ?? undefined,
          address: l.address,
          phone: l.phone,
          website: l.company_website || l.source_url,
        })),
    [mapLeads]
  );

  const focusedLead = useMemo(() => {
    const hit =
      aerialLeads.find((l) => l.id === focusedLeadId) ||
      aerialLeads[0] ||
      null;
    return hit;
  }, [aerialLeads, focusedLeadId]);

  const previewCenter = useMemo((): [number, number] | null => {
    const withGeo = mapLeads.find((l) => l.lat != null && l.lng != null);
    if (!withGeo || withGeo.lat == null || withGeo.lng == null) return null;
    return [withGeo.lat, withGeo.lng];
  }, [mapLeads]);

  const bumpResults = useCallback(() => {
    setRefreshKey((k) => k + 1);
    onActivity?.();
  }, [onActivity]);

  const runWithIntent = useCallback(
    async (intent: ParsedLeadIntent, label?: string) => {
      if (!tenant?.id) return;
      setSearching(true);
      try {
        const withRadius: ParsedLeadIntent = {
          ...intent,
          location: {
            ...(intent.location || {}),
            radius_km: intent.location?.radius_km || radiusKm,
          },
        };
        const runRes = await fetch('/api/scraper-campaigns/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: tenant.id,
            action: 'run',
            intent: withRadius,
          }),
        });
        const runData = await runRes.json();
        if (!runRes.ok) throw new Error(runData.error || 'Search failed');

        setActiveCampaignId(runData.campaignId ?? null);
        bumpResults();
        toast.success(label || runData.reply || 'Search complete');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setSearching(false);
      }
    },
    [tenant?.id, radiusKm, bumpResults]
  );

  const runSearch = useCallback(async () => {
    if (!tenant?.id) return;
    const nicheTrim = niche.trim();
    const locationTrim = location.trim();
    if (!nicheTrim) {
      toast.error('Enter a business type or niche to search');
      return;
    }

    const query = locationTrim
      ? `Find ${nicheTrim} businesses in ${locationTrim} within ${radiusKm} km`
      : `Find ${nicheTrim} businesses within ${radiusKm} km`;

    setSearching(true);
    try {
      const parseRes = await fetch('/api/scraper-campaigns/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          messages: [{ role: 'user', content: query }],
        }),
      });
      const parsed = await parseRes.json();
      if (!parseRes.ok) throw new Error(parsed.error || 'Failed to parse search');

      const intent = parsed.intent as ParsedLeadIntent | undefined;
      if (!intent) throw new Error('Could not build search intent');

      intent.location = {
        ...(intent.location || {}),
        radius_km: radiusKm,
      };

      await runWithIntent(intent);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
      setSearching(false);
    }
  }, [tenant?.id, niche, location, radiusKm, runWithIntent]);

  const handleProfileLoaded = useCallback(
    (profile: LeadFinderProfile) => {
      if (!profileLoaded) {
        if (profile.niche) setNiche(profile.niche);
        if (profile.location) setLocation(profile.location);
        setProfileLoaded(true);
      }
    },
    [profileLoaded]
  );

  const handleSmartSearch = useCallback(
    (intent: ParsedLeadIntent) => {
      if (intent.niche) setNiche(intent.niche);
      const loc = intent.location;
      const locLabel = [loc?.city, loc?.country].filter(Boolean).join(', ') || loc?.city || '';
      if (locLabel) setLocation(locLabel);
      if (loc?.radius_km) setRadiusKm(loc.radius_km);
      void runWithIntent(intent, 'Smart search from your profile');
    },
    [runWithIntent]
  );

  return (
    <VStack align="stretch" spacing={3} minH={0}>
      {/* Search first — always above the fold */}
      <Box
        borderWidth="1px"
        borderColor="whiteAlpha.200"
        borderRadius="lg"
        bg="gray.900"
        p={{ base: 3, md: 4 }}
        position="sticky"
        top={0}
        zIndex={5}
        boxShadow="sm"
      >
        <VStack align="stretch" spacing={3}>
          <HStack justify="space-between" wrap="wrap" gap={2}>
            <Text fontSize="sm" fontWeight="semibold" color="white">
              Search command
            </Text>
            <Badge colorScheme="teal" variant="subtle" fontSize="10px">
              Phone or email required
            </Badge>
          </HStack>

          <Grid templateColumns={{ base: '1fr', md: '1fr 1fr', xl: '1.2fr 1.2fr 0.8fr auto' }} gap={2.5}>
            <FormControl>
              <FormLabel fontSize="10px" textTransform="uppercase" letterSpacing="wide" color="gray.500" mb={1}>
                Niche
              </FormLabel>
              <InputGroup size="sm">
                <InputLeftElement pointerEvents="none" h="32px">
                  <Search size={14} color="#64748B" />
                </InputLeftElement>
                <Input
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
                  placeholder="dental clinics, HVAC, agencies…"
                  bg="gray.950"
                  borderColor="whiteAlpha.300"
                  color="white"
                  borderRadius="md"
                  _placeholder={{ color: 'gray.600' }}
                  _focus={{ borderColor: 'teal.400', boxShadow: '0 0 0 1px var(--chakra-colors-teal-400)' }}
                />
              </InputGroup>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="10px" textTransform="uppercase" letterSpacing="wide" color="gray.500" mb={1}>
                Location
              </FormLabel>
              <InputGroup size="sm">
                <InputLeftElement pointerEvents="none" h="32px">
                  <MapPin size={14} color="#64748B" />
                </InputLeftElement>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
                  placeholder="Austin, TX"
                  bg="gray.950"
                  borderColor="whiteAlpha.300"
                  color="white"
                  borderRadius="md"
                  _placeholder={{ color: 'gray.600' }}
                  _focus={{ borderColor: 'teal.400', boxShadow: '0 0 0 1px var(--chakra-colors-teal-400)' }}
                />
              </InputGroup>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="10px" textTransform="uppercase" letterSpacing="wide" color="gray.500" mb={1}>
                Reach
              </FormLabel>
              <InputGroup size="sm">
                <InputLeftElement pointerEvents="none" h="32px">
                  <Radar size={14} color="#64748B" />
                </InputLeftElement>
                <Select
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  bg="gray.950"
                  borderColor="whiteAlpha.300"
                  color="white"
                  borderRadius="md"
                  pl={10}
                  h="32px"
                >
                  {RADIUS_OPTIONS.map((km) => (
                    <option key={km} value={km} style={{ background: '#0f172a' }}>
                      {km} km
                    </option>
                  ))}
                </Select>
              </InputGroup>
            </FormControl>

            <Flex direction="column" justify="flex-end" gap={1.5}>
              <Checkbox
                isChecked={hasEmail}
                onChange={(e) => setHasEmail(e.target.checked)}
                colorScheme="teal"
                color="gray.400"
                size="sm"
              >
                Email only
              </Checkbox>
              <Button
                size="sm"
                onClick={() => void runSearch()}
                isLoading={searching}
                loadingText="Scraping…"
                colorScheme="teal"
                leftIcon={searching ? <Loader2 size={14} /> : <Search size={14} />}
                px={5}
                borderRadius="md"
              >
                Find leads
              </Button>
            </Flex>
          </Grid>
        </VStack>
      </Box>

      <LeadFinderSmartBar
        onProfileLoaded={handleProfileLoaded}
        onSmartSearch={handleSmartSearch}
        searching={searching}
      />

      <LeadFinderBeginnerGuide />

      <Grid
        templateColumns={{ base: '1fr', xl: 'minmax(0,1.15fr) minmax(300px,0.85fr)' }}
        gap={3}
        minH={0}
      >
        <Box minH={0}>
          <ScraperLeadsTable
            key={refreshKey}
            campaignId={activeCampaignId}
            hasEmailOnly={hasEmail}
            locationFilter={location.trim() || undefined}
            showAllWhenNoCampaign
            onActionComplete={onActivity}
            onLeadsChange={(leads) => {
              setMapLeads(leads);
              if (!focusedLeadId && leads[0]) setFocusedLeadId(leads[0].id);
            }}
            refreshToken={refreshKey}
            onFocusLead={setFocusedLeadId}
          />
        </Box>

        <VStack align="stretch" spacing={3} position={{ xl: 'sticky' }} top={2} alignSelf="start">
          <LeadFinderLiveProgress
            campaignId={activeCampaignId}
            searching={searching}
            niche={niche}
            location={location}
            radiusKm={radiusKm}
            onCompleted={bumpResults}
          />
          <LeadFinderMapPanel
            leads={mapPins}
            previewCenter={previewCenter}
            previewRadiusKm={radiusKm}
            emptyHint="Search to plot contactable leads on the free map."
            defaultStyle="satellite"
          />
          <LeadFinderAerialStudio
            lead={focusedLead}
            allLeads={aerialLeads}
            onSelectLead={(lead) => {
              if (lead.id) setFocusedLeadId(lead.id);
            }}
          />
          <Box maxH="min(36vh,320px)" overflowY="auto">
            <LeadFinderSystemPanel compact />
          </Box>
        </VStack>
      </Grid>
    </VStack>
  );
}
