'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Flex,
  HStack,
  IconButton,
  Link,
  Progress,
  SimpleGrid,
  Text,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Plane,
  Play,
  Pause,
  Satellite,
  Map as MapIcon,
} from 'lucide-react';

const AerialMiniMap = dynamic(() => import('./LeadFinderAerialMiniMap'), {
  ssr: false,
  loading: () => (
    <Box h="100%" minH="240px" bg="gray.950" display="flex" alignItems="center" justifyContent="center">
      <Text fontSize="sm" color="gray.500">
        Loading aerial view…
      </Text>
    </Box>
  ),
});

export type AerialLead = {
  id?: string;
  business_name: string;
  lat?: number;
  lng?: number;
  address?: string;
  phone?: string;
  website?: string;
};

export type AerialMode = 'aerial' | 'building' | 'birds' | 'street' | 'pano';

type Props = {
  lead: AerialLead | null;
  allLeads?: AerialLead[];
  onSelectLead?: (lead: AerialLead) => void;
};

function buildViewLinks(lat: number, lng: number) {
  const la = lat.toFixed(6);
  const ln = lng.toFixed(6);
  return {
    aerialOsm: `https://www.openstreetmap.org/#map=19/${la}/${ln}`,
    esriExplorer: `https://www.arcgis.com/apps/mapviewer/index.html?center=${ln},${la}&level=18&basemapUrl=https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer`,
    building3d: `https://www.google.com/maps/@${la},${ln},120a,35y,40h,60t/data=!3m1!1e3`,
    buildingImmersive: `https://www.google.com/maps/@${la},${ln},18z/data=!3m1!1e3`,
    birdsEye: `https://www.bing.com/maps?cp=${lat}~${lng}&lvl=20&style=h&dir=0`,
    birdsEyeNE: `https://www.bing.com/maps?cp=${lat}~${lng}&lvl=20&style=h&dir=45`,
    streetPano: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`,
    mapillary: `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=18`,
    kartaview: `https://kartaview.org/map/@${lat},${lng},18z`,
    osmBuildings: `https://osmbuildings.org/?lat=${lat}&lon=${lng}&zoom=18`,
  };
}

const MODE_META: Record<
  AerialMode,
  { label: string; blurb: string; Icon: typeof Plane }
> = {
  aerial: {
    label: 'Aerial',
    blurb: 'Free Esri satellite overhead — inspect rooftops & surroundings.',
    Icon: Satellite,
  },
  building: {
    label: 'Building 3D',
    blurb: 'Tilted 3D building / immersive look at the structure.',
    Icon: Building2,
  },
  birds: {
    label: 'Birds-eye',
    blurb: 'Angled birds-eye over the block (Bing free viewer).',
    Icon: Plane,
  },
  street: {
    label: 'Street',
    blurb: 'Mapillary / KartaView open street-level imagery.',
    Icon: Eye,
  },
  pano: {
    label: 'Pano',
    blurb: 'Street View panorama at this coordinate.',
    Icon: MapIcon,
  },
};

export default function LeadFinderAerialStudio({ lead, allLeads = [], onSelectLead }: Props) {
  const pinned = useMemo(
    () => allLeads.filter((l) => l.lat != null && l.lng != null),
    [allLeads]
  );
  const [mode, setMode] = useState<AerialMode>('aerial');
  const [touring, setTouring] = useState(false);
  const [tilt, setTilt] = useState(48);
  const [heading, setHeading] = useState(0);

  const activeIndex = useMemo(() => {
    if (!lead?.lat) return pinned.length ? 0 : -1;
    const idx = pinned.findIndex(
      (l) =>
        l.lat === lead.lat &&
        l.lng === lead.lng &&
        l.business_name === lead.business_name
    );
    return idx >= 0 ? idx : 0;
  }, [lead, pinned]);

  const active = pinned[activeIndex] || lead;
  const links =
    active?.lat != null && active?.lng != null
      ? buildViewLinks(active.lat, active.lng)
      : null;

  // Subtle orbit while aerial mode is active
  useEffect(() => {
    if (mode !== 'aerial' && mode !== 'building') return;
    const id = window.setInterval(() => {
      setHeading((h) => (h + 0.35) % 360);
      setTilt((t) => 42 + Math.sin(Date.now() / 2400) * 8);
    }, 48);
    return () => window.clearInterval(id);
  }, [mode]);

  // Aerial tour across leads
  useEffect(() => {
    if (!touring || pinned.length < 2) return;
    const id = window.setInterval(() => {
      const next = pinned[(activeIndex + 1) % pinned.length];
      onSelectLead?.(next);
    }, 4500);
    return () => window.clearInterval(id);
  }, [touring, pinned, activeIndex, onSelectLead]);

  const openPrimary = () => {
    if (!links) return '#';
    if (mode === 'aerial') return links.esriExplorer;
    if (mode === 'building') return links.building3d;
    if (mode === 'birds') return links.birdsEye;
    if (mode === 'street') return links.mapillary;
    return links.streetPano;
  };

  if (!active || active.lat == null || active.lng == null || !links) {
    return (
      <Box borderWidth="1px" borderColor="whiteAlpha.200" borderRadius="xl" bg="gray.900" p={5}>
        <HStack spacing={2} mb={2}>
          <Plane size={16} color="#2DD4BF" />
          <Text fontWeight="semibold" color="white">
            Aerial studio
          </Text>
          <Badge colorScheme="teal" variant="subtle">
            Free
          </Badge>
        </HStack>
        <Text fontSize="sm" color="gray.400">
          Run a search with geo leads to unlock aerial, building 3D, birds-eye, and street views.
        </Text>
      </Box>
    );
  }

  const MetaIcon = MODE_META[mode].Icon;

  return (
    <Box
      borderWidth="1px"
      borderColor="whiteAlpha.200"
      borderRadius="xl"
      bg="gray.900"
      overflow="hidden"
      boxShadow="0 0 0 1px rgba(45,212,191,0.08)"
    >
      <Flex
        px={4}
        py={3}
        borderBottomWidth="1px"
        borderColor="whiteAlpha.100"
        align="center"
        justify="space-between"
        gap={3}
        wrap="wrap"
      >
        <VStack align="start" spacing={0} minW={0}>
          <HStack spacing={2}>
            <Plane size={14} color="#2DD4BF" />
            <Text fontSize="sm" fontWeight="semibold" color="white" noOfLines={1}>
              Aerial studio
            </Text>
            <Badge colorScheme="teal" variant="subtle" fontSize="10px">
              Building · Birds-eye · Street
            </Badge>
          </HStack>
          <Text fontSize="xs" color="gray.500" noOfLines={1}>
            {active.business_name}
            {active.address ? ` · ${active.address}` : ''}
            {pinned.length > 1 ? ` · ${activeIndex + 1}/${pinned.length}` : ''}
          </Text>
        </VStack>

        <HStack spacing={1}>
          <Tooltip label="Previous lead">
            <IconButton
              aria-label="Previous lead"
              size="xs"
              variant="ghost"
              color="gray.300"
              icon={<ChevronLeft size={14} />}
              isDisabled={pinned.length < 2}
              onClick={() => {
                const prev = pinned[(activeIndex - 1 + pinned.length) % pinned.length];
                onSelectLead?.(prev);
              }}
            />
          </Tooltip>
          <Tooltip label={touring ? 'Pause aerial tour' : 'Play aerial tour'}>
            <IconButton
              aria-label="Tour"
              size="xs"
              colorScheme={touring ? 'teal' : 'gray'}
              variant={touring ? 'solid' : 'outline'}
              borderColor="whiteAlpha.300"
              icon={touring ? <Pause size={12} /> : <Play size={12} />}
              isDisabled={pinned.length < 2}
              onClick={() => setTouring((v) => !v)}
            />
          </Tooltip>
          <Tooltip label="Next lead">
            <IconButton
              aria-label="Next lead"
              size="xs"
              variant="ghost"
              color="gray.300"
              icon={<ChevronRight size={14} />}
              isDisabled={pinned.length < 2}
              onClick={() => {
                const next = pinned[(activeIndex + 1) % pinned.length];
                onSelectLead?.(next);
              }}
            />
          </Tooltip>
        </HStack>
      </Flex>

      <Box px={3} pt={3}>
        <ButtonGroup size="xs" isAttached variant="outline" flexWrap="wrap">
          {(Object.keys(MODE_META) as AerialMode[]).map((key) => {
            const ItemIcon = MODE_META[key].Icon;
            return (
              <Button
                key={key}
                leftIcon={<ItemIcon size={12} />}
                onClick={() => setMode(key)}
                colorScheme={mode === key ? 'teal' : 'gray'}
                variant={mode === key ? 'solid' : 'outline'}
                borderColor="whiteAlpha.300"
              >
                {MODE_META[key].label}
              </Button>
            );
          })}
        </ButtonGroup>
      </Box>

      <Box
        mt={3}
        mx={3}
        borderRadius="lg"
        overflow="hidden"
        borderWidth="1px"
        borderColor="whiteAlpha.200"
        position="relative"
        h={{ base: '240px', md: '300px' }}
        style={{
          perspective: '1200px',
        }}
      >
        <Box
          h="100%"
          style={{
            transform:
              mode === 'aerial' || mode === 'building'
                ? `rotateX(${tilt}deg) rotateZ(${heading * 0.08}deg) scale(1.12)`
                : 'none',
            transformOrigin: 'center center',
            transition: 'transform 0.2s linear',
          }}
        >
          <AerialMiniMap
            lat={active.lat}
            lng={active.lng}
            label={active.business_name}
            mode={mode === 'street' || mode === 'pano' ? 'streets' : 'satellite'}
            zoom={mode === 'building' || mode === 'birds' ? 19 : 18}
          />
        </Box>

        {/* HUD chrome */}
        <Box
          pointerEvents="none"
          position="absolute"
          inset={0}
          bgGradient="linear(to-t, blackAlpha.700, transparent 40%, blackAlpha.300)"
        />
        <HStack
          position="absolute"
          top={2}
          left={2}
          spacing={2}
          bg="blackAlpha.700"
          px={2}
          py={1}
          borderRadius="md"
          borderWidth="1px"
          borderColor="whiteAlpha.200"
        >
          <MetaIcon size={12} color="#5EEAD4" />
          <Text fontSize="10px" color="teal.200" fontWeight="bold" textTransform="uppercase">
            {MODE_META[mode].label} live
          </Text>
        </HStack>
        <Text
          position="absolute"
          bottom={2}
          left={3}
          right={3}
          fontSize="xs"
          color="whiteAlpha.900"
          noOfLines={2}
          fontWeight="medium"
        >
          {MODE_META[mode].blurb}
        </Text>
        {touring && (
          <Progress
            position="absolute"
            top={0}
            left={0}
            right={0}
            size="xs"
            colorScheme="teal"
            isIndeterminate
            bg="transparent"
          />
        )}
      </Box>

      <SimpleGrid columns={{ base: 2, sm: 3 }} spacing={2} p={3}>
        <Button
          as={Link}
          href={openPrimary()}
          isExternal
          size="sm"
          colorScheme="teal"
          rightIcon={<ExternalLink size={14} />}
          _hover={{ textDecoration: 'none' }}
        >
          Open full {MODE_META[mode].label.toLowerCase()}
        </Button>
        <Button
          as={Link}
          href={links.building3d}
          isExternal
          size="sm"
          variant="outline"
          borderColor="whiteAlpha.300"
          color="gray.100"
          leftIcon={<Building2 size={14} />}
          _hover={{ textDecoration: 'none', bg: 'whiteAlpha.100' }}
        >
          3D building
        </Button>
        <Button
          as={Link}
          href={links.birdsEye}
          isExternal
          size="sm"
          variant="outline"
          borderColor="whiteAlpha.300"
          color="gray.100"
          leftIcon={<Plane size={14} />}
          _hover={{ textDecoration: 'none', bg: 'whiteAlpha.100' }}
        >
          Birds-eye
        </Button>
        <Button
          as={Link}
          href={links.mapillary}
          isExternal
          size="sm"
          variant="ghost"
          color="gray.300"
          leftIcon={<Eye size={14} />}
          _hover={{ textDecoration: 'none', color: 'white' }}
        >
          Mapillary street
        </Button>
        <Button
          as={Link}
          href={links.osmBuildings}
          isExternal
          size="sm"
          variant="ghost"
          color="gray.300"
          leftIcon={<Building2 size={14} />}
          _hover={{ textDecoration: 'none', color: 'white' }}
        >
          OSM Buildings
        </Button>
        <Button
          as={Link}
          href={links.streetPano}
          isExternal
          size="sm"
          variant="ghost"
          color="gray.300"
          leftIcon={<MapIcon size={14} />}
          _hover={{ textDecoration: 'none', color: 'white' }}
        >
          Street pano
        </Button>
      </SimpleGrid>
    </Box>
  );
}
