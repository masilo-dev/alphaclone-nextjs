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
import { Loader2, MapPin, Radar, Search, Sparkles } from 'lucide-react';
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
import LeadFinderStreetViews from './LeadFinderStreetViews';

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

  const focusedLead = useMemo(() => {
    const hit = mapLeads.find((l) => l.id === focusedLeadId) || mapLeads.find((l) => l.lat != null);
    if (!hit) return null;
    return {
      business_name: hit.company || hit.name || 'Lead',
      lat: hit.lat ?? undefined,
      lng: hit.lng ?? undefined,
      address: hit.address,
    };
  }, [mapLeads, focusedLeadId]);

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
    <VStack align="stretch" spacing={4} minH={0} flex={1}>
      <LeadFinderBeginnerGuide />

      <LeadFinderSmartBar
        onProfileLoaded={handleProfileLoaded}
        onSmartSearch={handleSmartSearch}
        searching={searching}
      />

      <Box
        borderWidth="1px"
        borderColor="whiteAlpha.200"
        borderRadius="xl"
        bg="blackAlpha.400"
        p={{ base: 4, md: 5 }}
        boxShadow="lg"
        position="relative"
        overflow="hidden"
      >
        <Box
          position="absolute"
          inset={0}
          bg="radial-gradient(circle at top right, rgba(20,184,166,0.14), transparent 55%)"
          pointerEvents="none"
        />
        <VStack align="stretch" spacing={4} position="relative">
          <HStack justify="space-between" wrap="wrap" gap={2}>
            <Text fontSize="sm" fontWeight="semibold" color="white">
              Search command
            </Text>
            <Badge colorScheme="purple" variant="subtle">
              Auto-enrich · Decision makers · Phone/email required
            </Badge>
          </HStack>

          <Grid templateColumns={{ base: '1fr', md: '1fr 1fr', xl: '1.2fr 1.2fr 0.8fr auto' }} gap={3}>
            <FormControl>
              <FormLabel fontSize="11px" textTransform="uppercase" letterSpacing="wider" color="gray.500">
                Niche
              </FormLabel>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <Search size={16} color="#64748B" />
                </InputLeftElement>
                <Input
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
                  placeholder="dental clinics, HVAC, agencies…"
                  bg="gray.950"
                  borderColor="whiteAlpha.300"
                  color="white"
                  _placeholder={{ color: 'gray.600' }}
                  _focus={{ borderColor: 'teal.400', boxShadow: '0 0 0 1px var(--chakra-colors-teal-400)' }}
                />
              </InputGroup>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="11px" textTransform="uppercase" letterSpacing="wider" color="gray.500">
                Location
              </FormLabel>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <MapPin size={16} color="#64748B" />
                </InputLeftElement>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
                  placeholder="Austin, TX"
                  bg="gray.950"
                  borderColor="whiteAlpha.300"
                  color="white"
                  _placeholder={{ color: 'gray.600' }}
                  _focus={{ borderColor: 'teal.400', boxShadow: '0 0 0 1px var(--chakra-colors-teal-400)' }}
                />
              </InputGroup>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="11px" textTransform="uppercase" letterSpacing="wider" color="gray.500">
                Reach
              </FormLabel>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <Radar size={16} color="#64748B" />
                </InputLeftElement>
                <Select
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  bg="gray.950"
                  borderColor="whiteAlpha.300"
                  color="white"
                  pl={10}
                >
                  {RADIUS_OPTIONS.map((km) => (
                    <option key={km} value={km} style={{ background: '#0f172a' }}>
                      {km} km
                    </option>
                  ))}
                </Select>
              </InputGroup>
            </FormControl>

            <Flex direction="column" justify="flex-end" gap={2}>
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
                onClick={() => void runSearch()}
                isLoading={searching}
                loadingText="Scraping…"
                colorScheme="teal"
                leftIcon={searching ? <Loader2 size={16} /> : <Sparkles size={16} />}
                px={6}
              >
                Find leads
              </Button>
            </Flex>
          </Grid>

          <Text fontSize="xs" color="gray.500">
            Free stack: OpenStreetMap · Wikidata · Photon · DuckDuckGo · Railway Playwright enrichment.
            Vague website-only rows are dropped — every result has phone or email.
          </Text>
        </VStack>
      </Box>

      <Grid
        templateColumns={{ base: '1fr', xl: 'minmax(0,1.15fr) minmax(320px,0.85fr)' }}
        gap={4}
        minH={0}
        flex={1}
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

        <VStack align="stretch" spacing={4} position={{ xl: 'sticky' }} top={4} alignSelf="start">
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
          />
          <LeadFinderStreetViews lead={focusedLead} allLeads={mapPins} />
          <Box maxH="min(36vh,320px)" overflowY="auto" className="ac-scroll-full">
            <LeadFinderSystemPanel compact />
          </Box>
        </VStack>
      </Grid>
    </VStack>
  );
}
