'use client';

import React, { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Flex,
  HStack,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react';
import { ExternalLink, Eye, Map as MapIcon, Satellite } from 'lucide-react';

export type StreetViewLead = {
  business_name: string;
  lat?: number;
  lng?: number;
  address?: string;
};

type ViewMode = 'mapillary' | 'street' | 'satellite';

type Props = {
  lead: StreetViewLead | null;
  allLeads?: StreetViewLead[];
};

/**
 * Free location views — no paid Maps SDK required.
 * - Mapillary: open street-level imagery (free)
 * - Google Street View deep-link (free browser view)
 * - Esri/OSM satellite via external free viewers
 */
export default function LeadFinderStreetViews({ lead, allLeads = [] }: Props) {
  const [mode, setMode] = useState<ViewMode>('mapillary');
  const active = lead || allLeads.find((l) => l.lat != null && l.lng != null) || null;

  const links = useMemo(() => {
    if (!active?.lat || !active?.lng) return null;
    const lat = active.lat;
    const lng = active.lng;
    return {
      mapillary: `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=17`,
      street: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`,
      satellite: `https://www.openstreetmap.org/#map=18/${lat}/${lng}`,
      bingBirdsEye: `https://www.bing.com/maps?cp=${lat}~${lng}&lvl=19&style=h`,
      building: `https://www.google.com/maps/@${lat.toFixed(6)},${lng.toFixed(6)},110a,35y,45h,45t/data=!3m1!1e3`,
    };
  }, [active]);

  if (!active || !links) {
    return (
      <Box
        borderWidth="1px"
        borderColor="whiteAlpha.200"
        borderRadius="xl"
        bg="gray.900"
        p={4}
      >
        <Text fontSize="sm" color="gray.400">
          Select a mapped lead to open free street / satellite views.
        </Text>
      </Box>
    );
  }

  const primaryHref =
    mode === 'mapillary' ? links.mapillary : mode === 'street' ? links.street : links.satellite;

  return (
    <Box
      borderWidth="1px"
      borderColor="whiteAlpha.200"
      borderRadius="xl"
      bg="gray.900"
      overflow="hidden"
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
            <Eye size={14} color="#2DD4BF" />
            <Text fontSize="sm" fontWeight="semibold" color="white" noOfLines={1}>
              Free location views
            </Text>
            <Badge colorScheme="teal" variant="subtle" fontSize="10px">
              $0
            </Badge>
          </HStack>
          <Text fontSize="xs" color="gray.500" noOfLines={1}>
            {active.business_name}
            {active.address ? ` · ${active.address}` : ''}
          </Text>
        </VStack>
        <ButtonGroup size="xs" isAttached variant="outline">
          <Button
            leftIcon={<Eye size={12} />}
            onClick={() => setMode('mapillary')}
            colorScheme={mode === 'mapillary' ? 'teal' : 'gray'}
            variant={mode === 'mapillary' ? 'solid' : 'outline'}
            borderColor="whiteAlpha.300"
          >
            Street
          </Button>
          <Button
            leftIcon={<MapIcon size={12} />}
            onClick={() => setMode('street')}
            colorScheme={mode === 'street' ? 'teal' : 'gray'}
            variant={mode === 'street' ? 'solid' : 'outline'}
            borderColor="whiteAlpha.300"
          >
            Pano
          </Button>
          <Button
            leftIcon={<Satellite size={12} />}
            onClick={() => setMode('satellite')}
            colorScheme={mode === 'satellite' ? 'teal' : 'gray'}
            variant={mode === 'satellite' ? 'solid' : 'outline'}
            borderColor="whiteAlpha.300"
          >
            Map
          </Button>
        </ButtonGroup>
      </Flex>

      <Box
        h={{ base: '180px', md: '220px' }}
        bgImage="radial-gradient(circle at 30% 20%, rgba(45,212,191,0.16), transparent 55%), linear-gradient(160deg,#0f172a,#020617)"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={6}
      >
        <VStack spacing={3} textAlign="center">
          <Text fontSize="sm" color="gray.300" maxW="sm">
            {mode === 'mapillary' && 'Mapillary street-level imagery — free & open.'}
            {mode === 'street' && 'Open Street View panorama in a new tab (free).'}
            {mode === 'satellite' && 'OpenStreetMap detail view — free tiles.'}
          </Text>
          <HStack spacing={2} flexWrap="wrap" justify="center">
            <Button
              as={Link}
              href={primaryHref}
              isExternal
              size="sm"
              colorScheme="teal"
              rightIcon={<ExternalLink size={14} />}
              _hover={{ textDecoration: 'none' }}
            >
              Open {mode === 'mapillary' ? 'Mapillary' : mode === 'street' ? 'Street View' : 'OSM'}
            </Button>
            <Button
              as={Link}
              href={links.building}
              isExternal
              size="sm"
              variant="outline"
              borderColor="whiteAlpha.300"
              color="gray.200"
              rightIcon={<ExternalLink size={14} />}
              _hover={{ textDecoration: 'none', bg: 'whiteAlpha.100' }}
            >
              3D building
            </Button>
            <Button
              as={Link}
              href={links.bingBirdsEye}
              isExternal
              size="sm"
              variant="ghost"
              color="gray.400"
              _hover={{ textDecoration: 'none', color: 'white' }}
            >
              Bing birds-eye
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}
