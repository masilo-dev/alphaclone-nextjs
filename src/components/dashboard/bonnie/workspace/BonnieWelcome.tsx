'use client';

import React from 'react';
import {
  Box,
  Button,
  Heading,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react';
import {
  AlertTriangle,
  Brain,
  CalendarDays,
  FileText,
  Megaphone,
  Receipt,
  Target,
  Users,
} from 'lucide-react';
import { BONNIE_CHAKRA } from '../bonnieChakra';

export type BonnieSuggestion = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon?: 'crm' | 'invoice' | 'social' | 'calendar' | 'risk' | 'workflow' | 'docs';
};

const ICONS = {
  crm: Users,
  invoice: Receipt,
  social: Megaphone,
  calendar: CalendarDays,
  risk: AlertTriangle,
  workflow: Target,
  docs: FileText,
};

type Props = {
  workspaceName?: string;
  suggestions: BonnieSuggestion[];
  onSelect: (prompt: string) => void;
};

export default function BonnieWelcome({ workspaceName, suggestions, onSelect }: Props) {
  return (
    <Box
      mx="auto"
      h="full"
      w="full"
      maxW="3xl"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      px={{ base: 4, sm: 6 }}
      py={6}
    >
      <VStack spacing={2} mb={6} textAlign="center">
        <Box
          h={9}
          w={9}
          display="flex"
          alignItems="center"
          justifyContent="center"
          borderRadius="md"
          bg="teal.600"
          color="white"
        >
          <Brain size={16} aria-hidden />
        </Box>
        <Text fontSize="11px" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.12em" color="teal.300">
          {workspaceName || 'Your workspace'} · Bonnie
        </Text>
        <Heading size="md" color="white" letterSpacing="-0.02em" fontWeight="semibold">
          What should Bonnie execute?
        </Heading>
        <Text fontSize="sm" color="gray.400" maxW="lg" lineHeight="tall">
          Post socially, chase invoices, find leads, send outreach, and run accounting actions —
          Bonnie executes tools in this workspace.
        </Text>
      </VStack>

      <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={2.5}>
        {suggestions.map((item) => {
          const Icon = ICONS[item.icon || 'workflow'] || Target;
          return (
            <Button
              key={item.id}
              variant="outline"
              h="auto"
              py={3}
              px={3}
              borderRadius={BONNIE_CHAKRA.radii.panel}
              borderColor="whiteAlpha.200"
              bg="gray.950"
              justifyContent="flex-start"
              textAlign="left"
              whiteSpace="normal"
              onClick={() => onSelect(item.prompt)}
              _hover={{ borderColor: 'teal.500', bg: 'whiteAlpha.50' }}
              _focusVisible={{ boxShadow: '0 0 0 2px var(--chakra-colors-teal-500)' }}
            >
              <VStack align="start" spacing={2} w="full">
                <Box
                  h={7}
                  w={7}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  borderRadius="md"
                  bg="teal.900"
                  color="teal.300"
                >
                  <Icon size={14} />
                </Box>
                <Text fontSize="xs" fontWeight="semibold" color="white">
                  {item.title}
                </Text>
                <Text fontSize="11px" color="gray.500" lineHeight="tall" fontWeight="normal">
                  {item.description}
                </Text>
              </VStack>
            </Button>
          );
        })}
      </SimpleGrid>
    </Box>
  );
}
